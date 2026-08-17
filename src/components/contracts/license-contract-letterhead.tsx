import { GOCINEMA_LEGAL } from '@/lib/gocinema-legal';

export default function LicenseContractLetterhead() {
  return (
    <header className="lc-letterhead">
      <div className="lc-letterhead-brand">
        <img
          src="/images/gocinema-go-logo.png"
          alt="GO CINEMA"
          className="lc-letterhead-logo"
          width={132}
          height={148}
        />
        <div className="lc-letterhead-tag">
          Կինոթատրոն · ք. {GOCINEMA_LEGAL.city}
        </div>
      </div>
      <div className="lc-letterhead-meta">
        <div>{GOCINEMA_LEGAL.shortName}</div>
        <div>{GOCINEMA_LEGAL.address}</div>
        <div>{GOCINEMA_LEGAL.email}</div>
        <div>ՀՎՀՀ {GOCINEMA_LEGAL.tin}</div>
        <div className="lc-confidential">Գաղտնի փաստաթուղթ</div>
      </div>
    </header>
  );
}
