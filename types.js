// types.js - 공통 타입 정의 (JSDoc으로 타입 안전성 확보)

/**
 * @typedef {Object} Character
 * @property {string} name - 등장인물 이름
 * @property {string[]} tags - Danbooru 스타일 태그 배열
 * @property {string|null} folderId - 매칭된 폴더 ID (null이면 매칭 실패)
 * @property {ImageResult[]} [images] - 매칭된 이미지 배열
 */

/**
 * @typedef {Object} ImageResult
 * @property {string} url - 이미지 URL
 * @property {number} score - 매칭 점수 (0-100)
 * @property {Tag[]} tags - 이미지의 태그
 */

/**
 * @typedef {Object} Tag
 * @property {string} name - 태그 이름
 * @property {string} [category] - 태그 카테고리
 */

/**
 * @typedef {Object} FolderInfo
 * @property {string} _id - 폴더 ID
 * @property {string} name - 폴더 이름
 * @property {string|null} parentId - 부모 폴더 ID
 * @property {number} imageCount - 이미지 개수
 */

/**
 * @typedef {Object} ParseResponse
 * @property {boolean} success - 성공 여부
 * @property {Character[]} [characters] - 파싱된 등장인물 배열
 * @property {string} [error] - 에러 메시지
 */

/**
 * @typedef {Object} ExtensionConfig
 * @property {boolean} enabled - 익스텐션 활성화 여부
 * @property {string} apiKey - OpenAI API 키
 * @property {string} projectUrl - 프로젝트 URL (localhost:3000)
 * @property {string} [folderId] - 기본 폴더 ID (deprecated - 다중 인물 지원으로 대체)
 */

// Export for documentation purposes (JSDoc only)
export default {};
