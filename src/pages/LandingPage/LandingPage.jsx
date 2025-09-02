import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  useEffect(() => {
    // 添加导航栏滚动效果
    const handleScroll = () => {
      const navbar = document.querySelector('.landing-page .navbar');
      if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', handleScroll);

    // 初始化粒子效果
    if (window.particlesJS) {
      window.particlesJS("particles-js", {
        particles: {
          number: {
            value: 80,
            density: {
              enable: true,
              value_area: 800
            }
          },
          color: {
            value: "#3a5b99"
          },
          shape: {
            type: "circle",
            stroke: {
              width: 0,
              color: "#000000"
            },
            polygon: {
              nb_sides: 5
            }
          },
          opacity: {
            value: 0.2,
            random: false,
            anim: {
              enable: false,
              speed: 1,
              opacity_min: 0.1,
              sync: false
            }
          },
          size: {
            value: 3,
            random: true,
            anim: {
              enable: false,
              speed: 40,
              size_min: 0.1,
              sync: false
            }
          },
          line_linked: {
            enable: true,
            distance: 150,
            color: "#3a5b99",
            opacity: 0.15,
            width: 1
          },
          move: {
            enable: true,
            speed: 2,
            direction: "none",
            random: false,
            straight: false,
            out_mode: "out",
            bounce: false,
            attract: {
              enable: false,
              rotateX: 600,
              rotateY: 1200
            }
          }
        },
        interactivity: {
          detect_on: "canvas",
          events: {
            onhover: {
              enable: true,
              mode: "grab"
            },
            onclick: {
              enable: true,
              mode: "push"
            },
            resize: true
          },
          modes: {
            grab: {
              distance: 140,
              line_linked: {
                opacity: 0.3
              }
            },
            bubble: {
              distance: 400,
              size: 40,
              duration: 2,
              opacity: 8,
              speed: 3
            },
            repulse: {
              distance: 200,
              duration: 0.4
            },
            push: {
              particles_nb: 4
            },
            remove: {
              particles_nb: 2
            }
          }
        },
        retina_detect: true
      });
    }

    // 页面加载时的淡入效果
    document.body.classList.add("loaded");

    // 清理事件监听器
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="landing-page">
      {/* 导航栏 */}
      <nav className="navbar">
        <a href="#" className="logo">
          <i className="fas fa-scroll logo-icon"></i>
          问知轩
        </a>

      </nav>

      {/* 英雄区域 */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-subtitle">「认识你自己」 — 德尔斐神庙铭文</div>
            <h1 className="hero-title">问知轩</h1>
            <p className="hero-description">于无形之境，寻智慧之光。在对话的艺术中，发现自我，探寻真理。</p>
            <p className="hero-description">「认识自己的无知就是最大的智慧。」</p>
            <div className="hero-cta">
              <Link to="/chat" className="cta-button">开启智慧对话</Link>
              <a href="#about" className="secondary-button">了解更多</a>
            </div>
          </div>
        </div>
        <div className="hero-background">
          <div className="particles-container" id="particles-js"></div>
        </div>
      </section>

      {/* 关于区域 */}
      <section className="about-section" id="about">
        <div className="container">
          <h2 className="section-title">思辨的艺术</h2>
          <div className="features" id="features">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-question-circle"></i>
              </div>
              <h3 className="feature-title">产婆术</h3>
              <p className="feature-description">如同苏格拉底的产婆术，问知轩助您从心灵深处萌发思想的种子。我们不是知识的给予者，而是思想诞生的助产士，通过启发式提问，引导您发现自己内心深处的智慧。</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-comments"></i>
              </div>
              <h3 className="feature-title">辩证对话</h3>
              <p className="feature-description">在知与不知的边界徘徊，以苏格拉底式对话法为指引，我们通过质疑、反思与论证，剥离虚假的确定性，接近那永恒的真理。知道自己不知道，是智慧的开始。</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-lightbulb"></i>
              </div>
              <h3 className="feature-title">理性自省</h3>
              <p className="feature-description">遵循"未经检视的生活不值得过"的箴言，问知轩鼓励深刻的自我反思和理性批判。在这里，每一次对话都是灵魂的自我考察，每一次思辨都是迈向智慧的阶梯。</p>
            </div>
          </div>
        </div>
        <div className="decorative-circles"></div>
      </section>

      {/* 底部区域 */}
      <footer className="footer" id="contact">
        <div className="container">
          <div className="footer-wrapper">
            <div className="footer-main">
              <div className="footer-left">
                <div className="footer-logo">
                  <i className="fas fa-scroll logo-icon"></i>
                  问知轩
                </div>
                <p className="footer-quote">"智者知己不知，愚者不知己不知"</p>
                <p className="footer-description">以对话为舟，以智慧为岸。</p>
              </div>
              
              <div className="footer-right">
                <h3 className="contact-title">联系方式</h3>
                <div className="contact-container">
                  <div className="contact-box">
                    <a href="mailto:2413250743@qq.com" className="contact-link">
                      <div className="contact-icon">
                        <i className="fas fa-envelope"></i>
                      </div>
                      <div className="contact-info">
                        <h4>邮箱</h4>
                        <p>2413250743@qq.com</p>
                      </div>
                      <div className="contact-arrow">
                        <i className="fas fa-arrow-right"></i>
                      </div>
                    </a>
                  </div>
                  
                  <div className="contact-box">
                    <a href="https://github.com/TownBoats" className="contact-link" target="_blank" rel="noopener noreferrer">
                      <div className="contact-icon">
                        <i className="fab fa-github"></i>
                      </div>
                      <div className="contact-info">
                        <h4>Github</h4>
                        <p>TownBoats</p>
                      </div>
                      <div className="contact-arrow">
                        <i className="fas fa-arrow-right"></i>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="footer-divider"></div>
            
            <div className="copyright">
              <div className="copyright-quote">他人告诉你的不是知识，你思考后得到的才是智慧</div>
              <div className="copyright-info">&copy; 2025 <span>问知轩</span></div>
            </div>
          </div>
        </div>
        
        <div className="footer-background">
          <div className="footer-circle circle-1"></div>
          <div className="footer-circle circle-2"></div>
          <div className="footer-circle circle-3"></div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
