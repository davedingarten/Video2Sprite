import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Video2Sprite</h1>
      </header>
      <main className="app-body">
        <aside className="controls-pane" aria-label="Controls">
          <p className="placeholder">Controls will appear here.</p>
        </aside>
        <section className="preview-pane" aria-label="Preview">
          <p className="placeholder">Preview will appear here.</p>
        </section>
      </main>
    </div>
  );
}
