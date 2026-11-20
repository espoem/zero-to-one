import { render } from '@solidjs/web';
import { App } from './App.tsx';
import './styles.css';

const root = document.getElementById('root');
if (root) {
  render(() => <App />, root);
}
