import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AppContextProvider } from "./context/AppContext";

export default function App() {
  return (
    <AppContextProvider>
      <Suspense fallback={<p role="status">Loading...</p>}>
        <RouterProvider router={router} />
      </Suspense>
    </AppContextProvider>
  );
}
