// injected-script.js - SSE/EventSource 가로채기 스크립트
// LunaTalk CSP 정책을 위반하지 않도록 외부 파일로 분리

(function() {
  const originalEventSource = window.EventSource;
  window.EventSource = function(...args) {
    console.log('[Extension] 🌐 EventSource created:', args[0]);
    const eventSource = new originalEventSource(...args);

    eventSource.addEventListener('stream_complete', (e) => {
      console.log('[Extension] ✅ SSE stream_complete detected');
      window.dispatchEvent(new CustomEvent('extension:stream_complete', {
        detail: { timestamp: Date.now() }
      }));
    });

    return eventSource;
  };

  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0];

    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('[Extension] 🌐 SSE stream detected:', url);

      const reader = response.body.getReader();
      const stream = new ReadableStream({
        async start(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            if (text.includes('event: stream_complete')) {
              console.log('[Extension] ✅ SSE stream_complete detected via fetch');
              window.dispatchEvent(new CustomEvent('extension:stream_complete', {
                detail: { timestamp: Date.now() }
              }));
            }

            controller.enqueue(value);
          }
          controller.close();
        }
      });

      return new Response(stream, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response;
  };
})();
