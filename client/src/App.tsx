// App.tsx — route table + auth guard.
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./store";
import { AppShell } from "./components/AppShell";
import Login from "./pages/Login";
import PatientList from "./pages/PatientList";
import PatientDashboard from "./pages/PatientDashboard";

function Protected({ children }: { children: JSX.Element }) {
  const token = useAuth((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/"            element={<Protected><PatientList /></Protected>} />
      <Route path="/patients/:id" element={<Protected><PatientDashboard /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
