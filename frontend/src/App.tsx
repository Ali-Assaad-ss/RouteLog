import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Trips from "./pages/Trips";
import NotFound from "./pages/NotFound";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import TruckRoute from "./pages/TruckRoute";
import ELDLogGenerator from "./pages/Eldlog";

function LogOut() {
  localStorage.clear();
  return <Navigate to="/login" />;
}

function RegisterAndLogout() {
  localStorage.clear();
  return <Register />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Trips />
            </ProtectedRoute>
          }
        />
        <Route path="/register" element={<RegisterAndLogout />} />
        <Route
          path="/eld/:tripId"
          element={
            <ProtectedRoute>
              <ELDLogGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="/directions/:tripId"
          element={
            <ProtectedRoute>
              <TruckRoute />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<LogOut />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
