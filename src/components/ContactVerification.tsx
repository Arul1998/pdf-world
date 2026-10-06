import { useEffect, useRef, useState } from 'react';
type Turnstile = {
  render: (container: HTMLElement, options: { sitekey: string; action: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string;
  remove: (id: string) => void;
};
let loading: Promise<Turnstile> | undefined;
function loadTurnstile(): Promise<Turnstile> {
  const api = () => (window as Window & { turnstile?: Turnstile }).turnstile;
  if (api()) return Promise.resolve(api()!);
  if (!loading) {
    loading = new Promise<Turnstile>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => api() ? resolve(api()!) : reject(new Error('Verification unavailable'));
      script.onerror = () => { script.remove(); reject(new Error('Verification unavailable')); };
      document.head.appendChild(script);
    }).catch(error => { loading = undefined; throw error; });
  }
  return loading;
}
export function ContactVerification({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let widget: string | undefined;
    let api: Turnstile | undefined;
    onToken('');
    setFailed(false);
    loadTurnstile().then(loaded => {
      if (disposed || !container.current) return;
      api = loaded;
      widget = api.render(container.current, {
        sitekey: siteKey, action: 'contact',
        callback: token => { if (!disposed) onToken(token); },
        'expired-callback': () => onToken(''),
        'error-callback': () => { onToken(''); setFailed(true); },
      });
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; if (api && widget !== undefined) api.remove(widget); };
  }, [siteKey, onToken]);
  return <div><div ref={container} />{failed && <p role="alert">Verification could not load. Check your connection and reload this page.</p>}</div>;
}
