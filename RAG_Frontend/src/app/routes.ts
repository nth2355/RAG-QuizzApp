import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
const Chat = React.lazy(() => import("./components/Chat").then(module => ({ default: module.Chat })));
const Dashboard = React.lazy(() => import("./components/Dashboard").then(module => ({ default: module.Dashboard })));
const Documents = React.lazy(() => import("./components/Documents").then(module => ({ default: module.Documents })));
const Flashcards = React.lazy(() => import("./components/Flashcards").then(module => ({ default: module.Flashcards })));
const Layout = React.lazy(() => import("./components/Layout").then(module => ({ default: module.Layout })));
const Login = React.lazy(() => import("./components/Login").then(module => ({ default: module.Login })));
const Quiz = React.lazy(() => import("./components/Quiz").then(module => ({ default: module.Quiz })));
const Register = React.lazy(() => import("./components/Register").then(module => ({ default: module.Register })));
const Summarize = React.lazy(() => import("./components/Summarize").then(module => ({ default: module.Summarize })));
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return React.createElement(Navigate, { to: "/login", replace: true });
  }
  return children;
}

function HomeRedirect() {
  const token = localStorage.getItem("token");

  if (!token) {
    return React.createElement(Navigate, { to: "/login", replace: true });
  }
  // All authenticated users (student and teacher) start at the Dashboard.
  return React.createElement(Navigate, { to: "/dashboard", replace: true });
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: React.createElement(Login),
  },
  {
    path: "/register",
    element: React.createElement(Register),
  },

  {
    path: "/",
    element: React.createElement(Layout),
    children: [
      {
        index: true,
        element: React.createElement(HomeRedirect),
      },
      {
        path: "dashboard",
        element: React.createElement(
          ProtectedRoute,
          {},
          React.createElement(Dashboard),
        ),
      },
      {
        path: "documents",
        element: React.createElement(
          ProtectedRoute,
          {},
          React.createElement(Documents),
        ),
      },
      {
        path: "chat",
        element: React.createElement(
          ProtectedRoute,
          {},
          React.createElement(Chat),
        ),
      },
      {
        path: "summarize",
        element: React.createElement(
          ProtectedRoute,
          {},
          React.createElement(Summarize),
        ),
      },
      {
        path: "quiz",
        element: React.createElement(
          ProtectedRoute,
          {},
          React.createElement(Quiz),
        ),
      },
      {
        path: "flashcards",
        element: React.createElement(
          ProtectedRoute,
          {},
          React.createElement(Flashcards),
        ),
      },
    ],
  },
  {
    path: "*",
    element: React.createElement(Navigate, { to: "/", replace: true }),
  },
]);
