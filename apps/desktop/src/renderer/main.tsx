import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { MirrorWindow, parseMirrorHash } from "./mirror-window.tsx";
import "./styles.css";

// The floating phone window loads the same page with #mirror=<target>.
const mirror = parseMirrorHash(location.hash);
if (mirror) document.documentElement.classList.add("mirror-window");
createRoot(document.getElementById("root")!).render(mirror ? <MirrorWindow target={mirror} /> : <App />);
