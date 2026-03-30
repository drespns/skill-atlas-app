import { runTechnologyDetailInits } from "./technology-detail/runner";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void runTechnologyDetailInits();
  });
} else {
  void runTechnologyDetailInits();
}
