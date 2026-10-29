import { render } from '@builder.io/qwik';
import qwikLoader from '@builder.io/qwik/qwikloader.js?raw';
import { App } from './app';
import './style.css';
if (!document.getElementById('qwikloader')) {
  const script = document.createElement('script');
  script.id = 'qwikloader';
  script.textContent = qwikLoader;
  document.head.appendChild(script);
}
render(document.body, <App />);
