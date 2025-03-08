// ProtectedRoute.tsx
import { Navigate,useNavigate } from "react-router-dom";
import { jwtDecode, JwtPayload } from "jwt-decode";
import api from "../api";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants";
import { useState, useEffect, JSX } from "react";
import Navbar from "./Navbar";

interface JwtToken extends JwtPayload {
  exp: number;
}

const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // State to handle error messages
  let navigate = useNavigate();

  const refreshToken = async (): Promise<void> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN);
    if (!refreshToken) {
      setIsAuthorized(false);
      setErrorMessage("No refresh token found. Please log in again.");
      navigate("/login");
      return;
    }

    try {
      const response = await api.post("api/token/refresh/", { refresh: refreshToken });
      if (response.status === 200) {
        localStorage.setItem(ACCESS_TOKEN, response.data.access);
        setIsAuthorized(true);
        setErrorMessage(null); // Clear error message on successful refresh
      } else {
        setIsAuthorized(false);
        setErrorMessage("Session expired. Please log in again.");
        navigate("/login");
        // navigate
        
      }
    } catch (error) {
      setIsAuthorized(false);
      setErrorMessage("Error refreshing token. Please log in again.");
      localStorage.removeItem(ACCESS_TOKEN); // Optionally, clear tokens on error
      localStorage.removeItem(REFRESH_TOKEN);
      navigate("/login");
    }
  };

  const auth = async (): Promise<void> => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setIsAuthorized(false);
      setErrorMessage("No access token found. Please log in.");
      navigate("/login");
      return;
    }

    try {
      const { exp } = jwtDecode<JwtToken>(token);
      if (Date.now() >= exp * 1000) {
        await refreshToken(); // Token is expired, try to refresh it
      } else {
        setIsAuthorized(true);
        setErrorMessage(null); // Token is valid, clear any error message
      }
    } catch (error) {
      setIsAuthorized(false);
      setErrorMessage("Invalid token. Please log in again.");
      localStorage.removeItem(ACCESS_TOKEN); // Remove invalid token
      localStorage.removeItem(REFRESH_TOKEN); // Optionally, clear refresh token
      navigate("/login");
    }
  };

  useEffect(() => {
    auth();
  }, []);

  if (isAuthorized === null) {
    return <div>Loading...</div>;
  }

  if (errorMessage) {
    return <div>{errorMessage}</div>; // Display error message if there's an issue
  }

  return isAuthorized ?<div>
    <Navbar />
     {children}
      </div>: <Navigate to="/login" />;
};

export default ProtectedRoute;