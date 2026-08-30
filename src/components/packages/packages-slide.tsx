import { Check, Clock, Globe, Phone, Users } from 'lucide-react';
import { packages } from '@/data/packages';
import { GOCINEMA_LEGAL } from '@/lib/gocinema-legal';
import './packages-slide.css';

const THEME: Record<string, string> = {
  'private-party': 'is-party',
  corporate: 'is-corporate',
  'vip-date': 'is-date',
};

export default function PackagesSlide() {
  return (
    <div className="pkg-slide-stage">
      <article className="pkg-slide">
        <div className="pkg-slide-blob pkg-slide-blob--1" aria-hidden />
        <div className="pkg-slide-blob pkg-slide-blob--2" aria-hidden />
        <div className="pkg-slide-blob pkg-slide-blob--3" aria-hidden />

        <div className="pkg-slide-inner">
          <header className="pkg-slide-top">
            <div className="pkg-slide-brand">
              <div className="pkg-slide-logo-wrap">
                <div className="pkg-slide-logo-ring" aria-hidden />
                <img
                  src="/images/gocinema-go-logo.png"
                  alt="GO CINEMA"
                  className="pkg-slide-logo"
                  width={132}
                  height={148}
                />
              </div>
              <div>
                <div className="pkg-slide-kicker">Private events</div>
                <h1 className="pkg-slide-title">
                  Փաթեթներ և դահլիճի վարձակալություն
                </h1>
              </div>
            </div>
            <div className="pkg-slide-meta">
              <span className="pkg-slide-meta-chip">
                ք. {GOCINEMA_LEGAL.city}
              </span>
              <span className="pkg-slide-meta-chip">
                {GOCINEMA_LEGAL.address.replace(`ք. ${GOCINEMA_LEGAL.city}, `, '')}
              </span>
            </div>
          </header>

          <div className="pkg-slide-cards">
            {packages.map((pkg) => {
              const theme = THEME[pkg.id] || '';
              const Icon = pkg.icon;
              const featured = pkg.id === 'private-party';

              return (
                <div
                  key={pkg.id}
                  className={`pkg-slide-flip ${featured ? 'is-featured' : ''}`}
                >
                  <div className="pkg-slide-flip-inner">
                    <section className={`pkg-slide-face pkg-slide-face-front ${theme}`}>
                      <div className="pkg-slide-cover-visual">
                        <img
                          src={pkg.slideImage}
                          alt=""
                          className="pkg-slide-cover-img"
                        />
                      </div>
                      <div className="pkg-slide-cover-content">
                        <span className="pkg-slide-cover-badge">{pkg.badge}</span>
                        <div className="pkg-slide-cover-icon">
                          <Icon strokeWidth={2} />
                        </div>
                        <h2 className="pkg-slide-cover-title">{pkg.title}</h2>
                        <p className="pkg-slide-cover-sub">{pkg.subtitle}</p>
                        <span className="pkg-slide-cover-hint">Թերթիր</span>
                      </div>
                    </section>

                    <section className="pkg-slide-face pkg-slide-face-back pkg-slide-card">
                      <div className={`pkg-slide-card-accent ${theme}`} />
                      <div className="pkg-slide-card-layout">
                        <div className="pkg-slide-card-main">
                          <div className="pkg-slide-card-head">
                            <div className={`pkg-slide-icon ${theme}`}>
                              <Icon strokeWidth={2.2} />
                            </div>
                            <div className="pkg-slide-card-titles">
                              <span className={`pkg-slide-badge ${theme}`}>
                                {pkg.badge}
                              </span>
                              <h2 className="pkg-slide-card-title">{pkg.title}</h2>
                              <p className="pkg-slide-card-sub">{pkg.subtitle}</p>
                            </div>
                          </div>
                          <div className="pkg-slide-card-body">
                            <p className="pkg-slide-desc">{pkg.description}</p>
                            <ul className="pkg-slide-features">
                              {pkg.features.map((feature) => (
                                <li key={feature}>
                                  <span className={`pkg-slide-check ${theme}`}>
                                    <Check strokeWidth={3} />
                                  </span>
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className={`pkg-slide-card-visual ${theme}`}>
                          <img
                            src={pkg.slideImage}
                            alt={pkg.title}
                            className="pkg-slide-card-img"
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="pkg-slide-foot">
            <div className="pkg-slide-foot-item">
              <Phone />
              <span>
                Հեռ. <strong>+374 77 769 668</strong>
              </span>
            </div>
            <div className="pkg-slide-foot-item">
              <Clock />
              <span>
                Ամեն օր <strong>13:00 – 24:00</strong>
              </span>
            </div>
            <div className="pkg-slide-foot-item">
              <Users />
              <span>
                Մինչև <strong>42 հյուր</strong>
              </span>
            </div>
            <div className="pkg-slide-foot-item">
              <Globe />
              <strong>gocinema.am</strong>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
