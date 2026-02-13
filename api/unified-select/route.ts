/**
 * Extension Unified Select API
 *
 * ⚠️ 독립 프로젝트 분리 시 변환 필요:
 * - Next.js → Express/Fastify로 변환
 * - NextRequest/NextResponse → req/res로 변환
 * - @/auth → 자체 인증 미들웨어로 교체
 * - @/lib/rate-limiter → express-rate-limit 등으로 교체
 * - ClipFilter import 경로 수정: '../lib/clip/filter'
 */

// TODO: 독립 프로젝트 분리 시 아래 import 수정 필요
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { extensionRateLimiter, getClientIp } from '@/lib/rate-limiter';
import { ClipFilter } from '../lib/clip/filter';

/**
 * Extension Unified Selection API
 *
 * 하드코딩 제로 원칙:
 * - LLM이 대화 전체를 분석하여 상황과 캐릭터를 이해
 * - 각 캐릭터의 모든 이미지를 시맨틱하게 평가
 * - 상황에 가장 적합한 이미지 1장을 선택
 *
 * 보안 계층:
 * 1. 인증: 로그인 사용자는 무제한 사용
 * 2. Rate Limiting: 비로그인 사용자는 IP당 시간당 50회 제한
 * 3. Origin 검증: Extension에서만 호출 가능
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await auth();
    const isAuthenticated = !!session?.user?.id;

    // 2. Rate Limiting (비로그인 사용자만)
    if (!isAuthenticated) {
      const clientIp = getClientIp(request);
      const rateLimitResult = extensionRateLimiter.check(clientIp); // 50 requests/hour (설정값)

      if (!rateLimitResult.allowed) {
        const resetDate = new Date(rateLimitResult.resetAt);
        return NextResponse.json(
          {
            success: false,
            error: `Rate limit exceeded. Please try again at ${resetDate.toLocaleTimeString()}`,
            resetAt: rateLimitResult.resetAt,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': '50',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
            },
          }
        );
      }

      // Rate Limit 헤더 추가
      (request as any).__rateLimitHeaders = {
        'X-RateLimit-Limit': '50',
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
      };
    }

    // 3. 요청 본문 파싱
    const body = await request.json();
    const { text, characterFolders } = body;

    console.log('[Unified Select API] 🔍 REQUEST RECEIVED:');
    console.log('[Unified Select API] 📝 Text preview:', text?.substring(0, 200) + '...');
    console.log('[Unified Select API] 📁 Character folders count:', characterFolders?.length);

    // 입력 검증
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid request: text is required' },
        { status: 400 }
      );
    }

    if (!characterFolders || !Array.isArray(characterFolders)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: characterFolders is required' },
        { status: 400 }
      );
    }

    // 4. OpenRouter API 키 확인
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('[Unified Select API] Missing OPENROUTER_API_KEY');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 5. LLM 호출 준비
    console.log('[Unified Select API] 📤 Preparing LLM call with:', {
      textLength: text.length,
      foldersCount: characterFolders.length,
      totalImages: characterFolders.reduce(
        (sum: number, f: any) => sum + (f.images?.length || 0),
        0
      ),
    });

    // ===== 🔍 CRITICAL DEBUG: 실제 LLM에게 전달되는 데이터 =====
    console.log('[Unified Select API] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Unified Select API] 🔍 DEBUGGING: Data being sent to LLM');
    console.log('[Unified Select API] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 모든 폴더의 이미지 샘플 출력 (각 폴더당 처음 5개)
    characterFolders.forEach((folder: any, folderIdx: number) => {
      console.log(`\n[Unified Select API] 📁 Folder ${folderIdx + 1}: "${folder.name}"`);
      console.log(`[Unified Select API]    Total images: ${folder.images?.length || 0}`);

      const sampleSize = Math.min(5, folder.images?.length || 0);
      if (sampleSize > 0) {
        console.log(`[Unified Select API]    Showing first ${sampleSize} images:\n`);

        folder.images.slice(0, sampleSize).forEach((img: any, imgIdx: number) => {
          console.log(`[Unified Select API]       Image ${imgIdx + 1}:`);
          console.log(`[Unified Select API]       - ID: ${img._id}`);
          console.log(`[Unified Select API]       - nsfwLevel: "${img.nsfwLevel}"`);
          console.log(`[Unified Select API]       - Tags count: ${img.tags?.length || 0}`);

          // 태그 샘플 (처음 10개)
          const tagSample = (img.tags || [])
            .slice(0, 10)
            .map((t: any) => typeof t === 'object' ? t.name : t)
            .join(', ');
          console.log(`[Unified Select API]       - First 10 tags: ${tagSample}`);

          // NSFW 관련 태그 체크
          const nsfwTags = (img.tags || [])
            .filter((t: any) => {
              const tagName = (typeof t === 'object' ? t.name : t).toLowerCase();
              return ['sex', 'nude', 'naked', 'nipples', 'breasts', 'hetero', 'penis', 'pregnant', 'pregnancy', 'explicit', 'questionable', 'sensitive'].includes(tagName);
            })
            .map((t: any) => typeof t === 'object' ? t.name : t);

          if (nsfwTags.length > 0) {
            console.log(`[Unified Select API]       - ⚠️ NSFW tags found: ${nsfwTags.join(', ')}`);
          }
          console.log('');
        });
      }
    });

    console.log('[Unified Select API] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ===== 1단계: LLM이 대화 분석하여 적절한 NSFW 레벨 결정 =====
    console.log('[Unified Select API] 🤖 STAGE 1: Analyzing conversation to determine appropriate NSFW level...');

    const stage1Response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': request.headers.get('origin') || 'https://character-generator.local',
        'X-Title': 'masis Extension',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI that analyzes conversation context to extract character names and determine scene information.

Your task:
1. Read the conversation carefully
2. Extract ALL character names mentioned (keep original Korean names, no translation)
3. Summarize the scene/situation (what's happening, mood, atmosphere, and what each character is doing)
4. Determine what NSFW level is appropriate for this scene

NSFW Levels (from safe to explicit):
- "general": Safe for work, no sexual content (combat, daily life, casual conversation)
- "sensitive": Slightly suggestive but not explicit (swimsuit, underwear, romantic scenes)
- "questionable": Moderately sexual but not explicit (partial nudity, suggestive poses)
- "explicit": Explicit sexual content (nudity, sexual acts)

Output: Valid JSON only, no explanations.`,
          },
          {
            role: 'user',
            content: `Analyze this conversation and extract characters + scene summary + NSFW level:

${text}

Return JSON in this format:
{
  "characters": ["character name 1", "character name 2", ...],
  "sceneSummary": "brief summary including what's happening, mood, atmosphere, and what each character is doing",
  "clipQuery": "concise 1-2 sentence visual description focusing on key elements, mood, and character actions (max 50 words for CLIP image matching)",
  "appropriateNsfwLevel": "general|sensitive|questionable|explicit",
  "reasoning": "why this NSFW level is appropriate for this scene"
}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!stage1Response.ok) {
      const errorText = await stage1Response.text();
      console.error('[Unified Select API] Stage 1 OpenRouter error:', stage1Response.status, errorText);
      return NextResponse.json(
        { success: false, error: `OpenRouter API error (Stage 1): ${stage1Response.status}` },
        { status: stage1Response.status }
      );
    }

    const stage1Data = await stage1Response.json();
    const stage1Content = stage1Data.choices[0]?.message?.content?.trim() || '{}';

    let nsfwAnalysis;
    try {
      nsfwAnalysis = JSON.parse(stage1Content);
    } catch (e) {
      console.error('[Unified Select API] Failed to parse Stage 1 response:', e);
      return NextResponse.json(
        { success: false, error: 'Failed to parse NSFW analysis' },
        { status: 500 }
      );
    }

    const appropriateNsfwLevel = nsfwAnalysis.appropriateNsfwLevel || 'general';
    const extractedCharacters = nsfwAnalysis.characters || [];

    console.log('[Unified Select API] ✅ STAGE 1 COMPLETE:', {
      characters: extractedCharacters,
      determinedLevel: appropriateNsfwLevel,
      reasoning: nsfwAnalysis.reasoning,
    });

    // ===== 2단계: 서버에서 캐릭터 매칭 + NSFW 필터링 =====
    console.log('[Unified Select API] 🔍 STAGE 2: Matching characters and filtering images...');

    // 2-1. 캐릭터 이름 매칭 (fuzzy matching)
    const matchedFolders = characterFolders
      .map((folder: any) => {
        // 추출된 캐릭터 중 이 폴더와 매칭되는 것 찾기
        const matchedChar = extractedCharacters.find((charName: string) => {
          const folderNameLower = folder.name.toLowerCase();
          const charNameLower = charName.toLowerCase();

          // 정확히 일치하거나, 폴더 이름에 캐릭터 이름이 포함되어 있으면 매칭
          return folderNameLower === charNameLower ||
                 folderNameLower.includes(charNameLower) ||
                 charNameLower.includes(folderNameLower);
        });

        return matchedChar ? { ...folder, matchedCharacterName: matchedChar } : null;
      })
      .filter((folder: any) => folder !== null);

    console.log(`[Unified Select API]    ✅ Matched ${matchedFolders.length} folders from ${extractedCharacters.length} characters`);
    matchedFolders.forEach((folder: any) => {
      console.log(`[Unified Select API]       "${folder.matchedCharacterName}" → "${folder.name}"`);
    });

    // 2-2. NSFW 레벨로 이미지 필터링
    const filteredCharacterFolders = matchedFolders.map((folder: any) => {
      const originalCount = folder.images?.length || 0;

      // general/sensitive는 묶어서 처리 (둘 다 안전한 범주)
      const allowedLevels =
        appropriateNsfwLevel === 'general' || appropriateNsfwLevel === 'sensitive'
          ? ['general', 'sensitive']
          : [appropriateNsfwLevel];

      const filteredImages = (folder.images || []).filter((img: any) =>
        allowedLevels.includes(img.nsfwLevel)
      );

      console.log(`[Unified Select API]    📁 "${folder.name}": ${originalCount} total → ${filteredImages.length} after filtering (allowed: ${allowedLevels.join(', ')})`);

      return {
        ...folder,
        images: filteredImages,
      };
    });

    const totalFiltered = filteredCharacterFolders.reduce(
      (sum: number, f: any) => sum + (f.images?.length || 0),
      0
    );
    console.log('[Unified Select API] ✅ STAGE 2 COMPLETE: Total images after filtering:', totalFiltered);

    // ===== 2.5단계: CLIP 시맨틱 유사도로 Top-K 이미지 선택 =====
    console.log('[Unified Select API] 🎨 STAGE 2.5: CLIP semantic similarity filtering...');

    const clipProvider = (process.env.CLIP_PROVIDER || 'local') as 'local' | 'replicate' | 'openai';
    const clipEndpoint = process.env.LOCAL_CLIP_ENDPOINT || 'http://localhost:8000';
    const clipApiKey = process.env.REPLICATE_API_KEY || '';

    let clipFilteredFolders = filteredCharacterFolders;

    // CLIP 사용 가능 여부 확인
    const clipEnabled =
      (clipProvider === 'local' && clipEndpoint) ||
      (clipProvider === 'replicate' && clipApiKey) ||
      (clipProvider === 'openai' && clipApiKey);

    if (clipEnabled && (nsfwAnalysis.clipQuery || nsfwAnalysis.sceneSummary)) {
      try {
        console.log(`[Unified Select API]    Using CLIP provider: ${clipProvider}`);

        const clipFilter = new ClipFilter(
          {
            apiKey: clipApiKey,
            endpoint: clipEndpoint,
            model: 'ViT-L/14',
            timeout: 60000,
          },
          clipProvider
        );

        // 각 캐릭터별로 CLIP 필터링 수행
        clipFilteredFolders = await Promise.all(
          filteredCharacterFolders.map(async (folder: any) => {
            const images = folder.images || [];

            // 이미지가 10개 이하면 CLIP 필터링 스킵 (이미 적은 수)
            if (images.length <= 10) {
              console.log(`[Unified Select API]    ⏩ "${folder.name}": ${images.length} images, skipping CLIP (already small)`);
              return folder;
            }

            // CLIP 필터링 수행 (Top-10)
            // clipQuery 우선 사용, 없으면 sceneSummary 사용
            const clipQuery = nsfwAnalysis.clipQuery || nsfwAnalysis.sceneSummary;
            const clipResult = await clipFilter.filterImagesBySimilarity(
              clipQuery,
              images,
              { topK: 10, minSimilarity: 0.0 }
            );

            if (clipResult.success && clipResult.topImages.length > 0) {
              console.log(`[Unified Select API]    ✅ "${folder.name}": ${images.length} → ${clipResult.topImages.length} images (CLIP filtered)`);

              return {
                ...folder,
                images: clipResult.topImages.map((item: any) => item.image),
              };
            } else {
              console.warn(`[Unified Select API]    ⚠️  "${folder.name}": CLIP filtering failed, using all images`);
              return folder;
            }
          })
        );

        const totalAfterClip = clipFilteredFolders.reduce(
          (sum: number, f: any) => sum + (f.images?.length || 0),
          0
        );
        console.log(`[Unified Select API] ✅ STAGE 2.5 COMPLETE: ${totalFiltered} → ${totalAfterClip} images (CLIP semantic filtering)`);
      } catch (clipError) {
        console.error('[Unified Select API] ❌ CLIP filtering error:', clipError);
        console.log('[Unified Select API] ⚠️  Falling back to original filtered images');
        // CLIP 실패 시 원본 필터링된 이미지 사용
      }
    } else {
      console.log('[Unified Select API] ⚠️  CLIP disabled: missing API key or scene summary');
    }

    // ===== 3단계: LLM이 필터링된 이미지 중 최적의 이미지 선택 =====
    console.log('[Unified Select API] 🤖 STAGE 3: LLM selecting best images from CLIP-filtered candidates...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': request.headers.get('origin') || 'https://character-generator.local',
        'X-Title': 'masis Extension',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI that selects appropriate character images based on conversation context.

Task:
1. Extract character names from conversation (EXACT names, no translation)
2. Match names to available folders
3. Select ONE best image per character based on scene context, mood, and visual coherence

Output: Valid JSON only, no explanations.`,
          },
          {
            role: 'user',
            content: buildUnifiedPrompt(text, clipFilteredFolders, nsfwAnalysis),
          },
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Unified Select API] OpenRouter error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `OpenRouter API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim() || '{}';

    // 7. JSON 파싱 및 검증
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.warn('[Unified Select API] JSON parse failed, attempting recovery...');

      // JSON 복구 시도
      let fixedContent = content;
      if (!fixedContent.endsWith('}')) {
        const lastCompleteObject = fixedContent.lastIndexOf('}');
        if (lastCompleteObject > 0) {
          fixedContent = fixedContent.substring(0, lastCompleteObject + 1);
          if (!fixedContent.includes(']')) {
            fixedContent += ']';
          }
          if (!fixedContent.endsWith('}')) {
            fixedContent += '}';
          }
        }
      }

      try {
        parsed = JSON.parse(fixedContent);
      } catch (recoveryError) {
        console.error('[Unified Select API] JSON recovery failed:', recoveryError);
        return NextResponse.json(
          { success: false, error: 'Failed to parse LLM response' },
          { status: 500 }
        );
      }
    }

    // 8. 응답 검증
    if (!parsed.characters || !Array.isArray(parsed.characters)) {
      return NextResponse.json(
        { success: false, error: 'Invalid response structure: missing characters array' },
        { status: 500 }
      );
    }

    console.log('[Unified Select API] ✅ STAGE 3 COMPLETE - LLM returned:', {
      charactersFound: parsed.characters.length,
      characters: parsed.characters.map((c: any) => ({
        name: c.name,
        hasImage: !!c.selectedImageId,
      })),
    });

    // 9. 성공 응답
    const responseHeaders = (request as any).__rateLimitHeaders || {};

    return NextResponse.json(
      {
        success: true,
        data: {
          characters: parsed.characters,
        },
      },
      {
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error('[Unified Select API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 통합 LLM 프롬프트 생성 (Stage 2 - 요약된 상황 기반)
 *
 * @param text 원본 대화 텍스트
 * @param characterFolders 필터링된 캐릭터별 폴더 및 이미지 정보
 * @param sceneAnalysis Stage 1에서 분석한 상황 요약
 * @returns LLM 프롬프트
 */
function buildUnifiedPrompt(text: string, characterFolders: any[], sceneAnalysis: any): string {
  // 캐릭터별 이미지 정보 포맷팅
  const foldersText = characterFolders
    .map((folder, folderIdx) => {
      const imagesText = (folder.images || [])
        .map(
          (img: any, imgIdx: number) =>
            `    Image ${imgIdx + 1} (ID: ${img._id}):
      Tags: ${(img.tags || []).map((t: any) => (typeof t === 'object' ? t.name : t)).join(', ')}`
        )
        .join('\n\n');

      return `Character: "${folder.matchedCharacterName}" (Folder: "${folder.name}")
  Total Images: ${folder.images?.length || 0}

${imagesText}`;
    })
    .join('\n\n');

  return `# CHARACTER IMAGE SELECTION

## SCENE CONTEXT:
${sceneAnalysis.sceneSummary}

NSFW Level: ${sceneAnalysis.appropriateNsfwLevel}
Reasoning: ${sceneAnalysis.reasoning}

## AVAILABLE CHARACTERS AND IMAGES (already matched and filtered):
${foldersText}

## YOUR TASK:

For EACH character above, select ONE best image based on:
- Scene context and what this character is doing
- Mood and atmosphere
- Visual tags matching the scene

## OUTPUT FORMAT:
Return JSON:
{
  "characters": [
    {
      "name": "character name",
      "folderName": "folder name",
      "selectedImageId": "image ID",
      "selectedScore": 85,
      "selectionReason": "why this image fits the scene",
      "status": "matched"
    }
  ]
}

IMPORTANT:
- All characters have already been matched to folders
- If a character has 0 images, set status to "unmatched" and omit selectedImageId
- Return results for ALL characters provided

---

Now select the most appropriate image for each character from the filtered images.`;
}
