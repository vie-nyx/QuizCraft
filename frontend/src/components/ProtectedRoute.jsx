// components/ProtectedRoute.js
import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }) => {
  const student = sessionStorage.getItem("student");

  if (!student) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
