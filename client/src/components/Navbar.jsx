import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "./ThemeToggle";
import "../styles/navbar.css";

export default function Navbar() {
  const { currentUser, logOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const result = await logOut();
    if (result.success) {
      navigate("/login");
    }
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          <div className="neon glass navbar-icon" />
          <strong>CogniVault</strong>
        </Link>

        <nav className="navbar-nav">
          <NavLink
            to="/"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Home
          </NavLink>
          <a href="#about" className="nav-link">About</a>
          {currentUser ? (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Vault
              </NavLink>
              <NavLink
                to="/incognito"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Incognito
              </NavLink>
              <button
                onClick={handleLogout}
                className="nav-link nav-button"
                type="button"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Login
              </NavLink>
              <NavLink
                to="/signup"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Sign Up
              </NavLink>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}


