import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Chat } from "./components/Chat";
import { Dashboard } from "./components/Dashboard";
import { Documents } from "./components/Documents";
import { Flashcards } from "./components/Flashcards";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { Quiz } from "./components/Quiz";
import { Register } from "./components/Register";
import { Summarize } from "./components/Summarize";
function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "teacher" | "student";
}) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return React.createElement(Navigate, { to: "/login", replace: true });
  }

  if (requiredRole && role !== requiredRole) {
    return React.createElement(Navigate, {
      to: role === "teacher" ? "/dashboard" : "/quiz",
      replace: true,
    });
  }

  return children;
}

function HomeRedirect() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return React.createElement(Navigate, { to: "/login", replace: true });
  }
  return React.createElement(Navigate, {
    to: role === "teacher" ? "/dashboard" : "/quiz",
    replace: true,
  });
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
