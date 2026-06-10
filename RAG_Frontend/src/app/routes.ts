import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Documents } from "./components/Documents";
import { Chat } from "./components/Chat";
import { Summarize } from "./components/Summarize";
import { Quiz } from "./components/Quiz";
import { Flashcards } from "./components/Flashcards";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "documents", Component: Documents },
      { path: "chat", Component: Chat },
      { path: "summarize", Component: Summarize },
      { path: "quiz", Component: Quiz },
      { path: "flashcards", Component: Flashcards },
    ],
  },
]);
