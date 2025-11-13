import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ParticleBackground from "./ParticleBackground";
import heroImage from "../assets/home.jpeg";
import "../styles/landing.css";

export default function HeroSection() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setMousePos({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
      }
    };

    const hero = heroRef.current;
    if (hero) {
      hero.addEventListener('mousemove', handleMouseMove);
      return () => hero.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  return (
    <section className="hero" ref={heroRef}>
      <div className="hero-bg">
        {/* Replace with your video: place file at /public/assets/hero-bg.mp4 */}
        {/* <video src="/assets/hero-bg.mp4" autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.12 }} /> */}
        <ParticleBackground />
        <div className="hero-gradient" />
      </div>

      <div className="container hero-content">
        <div className="hero-copy">
          <div className="hero-kicker glass neon" style={{ animationDelay: '0ms' }}>
            AI-Powered Memory
          </div>
          <h1 className="h1 hero-title" style={{ margin: 0, animationDelay: '200ms' }}>
            Your Mind. Remembered Forever.
          </h1>
          <p className="subtitle hero-subtitle" style={{ margin: 0, animationDelay: '400ms' }}>
            CogniVault turns your thoughts, notes, and documents into a living, searchable memory system.
          </p>

          <div className="hero-cta" style={{ animationDelay: '600ms' }}>
            <Link to="/dashboard" className="btn btn-primary btn-ripple">
              Enter Your Vault
            </Link>
            <a href="#about" className="btn btn-ripple">Learn More</a>
          </div>
        </div>

        <div className="hero-visual">
          <div
            className="hero-card glass neon card-tilt"
            style={{
              transform: `perspective(1000px) rotateX(${(mousePos.y - 0.5) * 4}deg) rotateY(${(mousePos.x - 0.5) * -4}deg) translateY(-2px)`,
            }}
          >
            <div className="hero-card-inner">
              <div className="hero-card-glow" />
              <img
                src={heroImage}
                alt="CogniVault experience preview"
                className="hero-image"
                loading="eager"
              />
              <span className="hero-note">Futuristic UI • Glass • Parallax</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


