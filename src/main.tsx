import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";

// 隐藏初始加载器
const hideInitialLoader = () => {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.classList.add('hidden');
  }
};

// 应用包装器，用于在挂载后隐藏初始加载器
function AppWithLoader() {
  useEffect(() => {
    // React应用挂载后立即隐藏初始加载器
    hideInitialLoader();
  }, []);

  return (
    <AppWrapper>
      <App />
    </AppWrapper>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppWithLoader />
  </StrictMode>
);
