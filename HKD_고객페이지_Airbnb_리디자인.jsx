import { useState, useEffect } from "react";

// ── Airbnb Design Tokens ──
const colors = {
  white: "#ffffff",
  nearBlack: "#222222",
  rauschRed: "#ff385c",
  deepRausch: "#e00b41",
  secondaryGray: "#6a6a6a",
  lightGray: "#f2f2f2",
  borderGray: "#c1c1c1",
  disabledText: "rgba(0,0,0,0.24)",
  cardShadow: "rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px, rgba(0,0,0,0.1) 0px 4px 8px",
  hoverShadow: "rgba(0,0,0,0.08) 0px 4px 12px",
  green: "#008A05",
  greenBg: "#E8F5E9",
  yellowBg: "#FFF8E1",
  yellowText: "#F57F17",
  purpleBg: "#F3E5F5",
  purpleText: "#7B1FA2",
  blueBg: "#E3F2FD",
  blueText: "#1565C0",
};

const shadows = {
  card: colors.cardShadow,
  hover: colors.hoverShadow,
};

const radius = { sm: 8, md: 14, lg: 20, xl: 32, circle: "50%" };

// ── Mock Data ──
const mockCategories = [
  { name: "한식", count: 12, openCount: 8, orderCount: 156, image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=120&h=80&fit=crop" },
  { name: "중식", count: 8, openCount: 5, orderCount: 89, image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=120&h=80&fit=crop" },
  { name: "일식", count: 6, openCount: 4, orderCount: 72, image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=120&h=80&fit=crop" },
  { name: "치킨", count: 10, openCount: 7, orderCount: 134, image: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=120&h=80&fit=crop" },
  { name: "피자", count: 5, openCount: 3, orderCount: 67, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=120&h=80&fit=crop" },
  { name: "분식", count: 7, openCount: 6, orderCount: 98, image: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=120&h=80&fit=crop" },
  { name: "카페/디저트", count: 4, openCount: 3, orderCount: 45, image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=120&h=80&fit=crop" },
];

const mockRestaurants = {
  "한식": [
    { id: "r1", name: "할머니 손맛 설렁탕", hours: "10:00-21:00", distance: "0.8", isOpen: true, isHot: true, isRecommended: true, description: "40년 전통 사골설렁탕 전문점" },
    { id: "r2", name: "청기와 불고기", hours: "11:00-22:00", distance: "1.2", isOpen: true, isHot: false, isRecommended: false, description: "숯불 양념불고기" },
    { id: "r3", name: "미소가 김치찌개", hours: "09:00-20:00", distance: "0.5", isOpen: false, isHot: false, isRecommended: false, description: "" },
  ],
  "치킨": [
    { id: "r4", name: "황금올리브 치킨", hours: "15:00-01:00", distance: "1.5", isOpen: true, isHot: true, isRecommended: true, description: "바삭한 올리브유 치킨" },
    { id: "r5", name: "맘스터치 한경점", hours: "10:00-23:00", distance: "0.9", isOpen: true, isHot: false, isRecommended: false, description: "" },
  ],
};

const mockMenus = [
  { id: "m1", name: "사골설렁탕", price: 12000, description: "진한 사골육수에 수육과 면사리", image: "https://images.unsplash.com/photo-1583224994076-0a3e76d7bc5d?w=200&h=200&fit=crop" },
  { id: "m2", name: "갈비탕", price: 15000, description: "부드러운 갈비와 당면이 가득", image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=200&fit=crop" },
  { id: "m3", name: "육개장", price: 11000, description: "얼큰한 소고기 육개장", image: "https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?w=200&h=200&fit=crop" },
  { id: "m4", name: "수육 (소)", price: 25000, description: "부드러운 수육 소 사이즈", image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop" },
  { id: "m5", name: "공기밥", price: 1000, description: "", image: "" },
];

const mockOrders = [
  {
    id: "og1", status: "delivering", address: "한경면 신한로 123", createdAt: "2026-04-04T12:30:00",
    totalAmount: 38000,
    orders: [
      { restaurant: "할머니 손맛 설렁탕", orderNumber: "HKD-0412-001", items: [{ name: "사골설렁탕", qty: 2, price: 24000 }, { name: "공기밥", qty: 2, price: 2000 }], subtotal: 26000 },
      { restaurant: "황금올리브 치킨", orderNumber: "HKD-0412-002", items: [{ name: "양념치킨", qty: 1, price: 12000 }], subtotal: 12000 },
    ],
    pickupProgress: { total: 2, picked: 1, details: [{ name: "할머니 손맛 설렁탕", picked: true }, { name: "황금올리브 치킨", picked: false }] }
  },
  {
    id: "og2", status: "completed", address: "한경면 신한로 456", createdAt: "2026-04-04T11:00:00",
    totalAmount: 15000,
    orders: [
      { restaurant: "청기와 불고기", orderNumber: "HKD-0411-003", items: [{ name: "불고기 정식", qty: 1, price: 15000 }], subtotal: 15000 },
    ],
    pickupProgress: null,
  },
];

// ── SVG Icons ──
const Icons = {
  back: (
    <svg width="24" height="24" fill="none" stroke={colors.nearBlack} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  location: (
    <svg width="16" height="16" fill="none" stroke={colors.secondaryGray} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cart: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  orders: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevronDown: (
    <svg width="20" height="20" fill="none" stroke={colors.secondaryGray} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg width="14" height="14" fill="none" stroke={colors.secondaryGray} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  ),
  phone: (
    <svg width="16" height="16" fill="none" stroke={colors.secondaryGray} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  star: <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  check: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  minus: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" fill="none" stroke={colors.secondaryGray} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  ),
  delivery: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ── Badge Component ──
const Badge = ({ children, color = "gray", style = {} }) => {
  const colorMap = {
    red: { bg: "#FFEBEE", text: colors.rauschRed },
    green: { bg: colors.greenBg, text: colors.green },
    yellow: { bg: colors.yellowBg, text: colors.yellowText },
    purple: { bg: colors.purpleBg, text: colors.purpleText },
    blue: { bg: colors.blueBg, text: colors.blueText },
    gray: { bg: colors.lightGray, text: colors.secondaryGray },
  };
  const c = colorMap[color] || colorMap.gray;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: radius.md, fontSize: 12, fontWeight: 600, backgroundColor: c.bg, color: c.text, letterSpacing: "0.02em", ...style }}>
      {children}
    </span>
  );
};

// ── Button Component ──
const Button = ({ children, variant = "primary", onClick, disabled, style = {}, fullWidth }) => {
  const [hovered, setHovered] = useState(false);
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "0 24px", height: 48, borderRadius: radius.sm, fontSize: 16, fontWeight: 500,
    border: "none", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s",
    width: fullWidth ? "100%" : "auto", opacity: disabled ? 0.4 : 1,
    fontFamily: "inherit",
  };
  const variants = {
    primary: { backgroundColor: hovered && !disabled ? colors.rauschRed : colors.nearBlack, color: colors.white },
    secondary: { backgroundColor: colors.white, color: colors.nearBlack, border: `1px solid ${colors.borderGray}`, boxShadow: hovered ? shadows.hover : "none" },
    ghost: { backgroundColor: "transparent", color: colors.nearBlack, padding: "0 12px" },
    brand: { backgroundColor: colors.rauschRed, color: colors.white },
  };
  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
};

// ── Card Component ──
const Card = ({ children, style = {}, onClick, hoverable }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        backgroundColor: colors.white, borderRadius: radius.lg, boxShadow: hovered && hoverable ? shadows.hover : shadows.card,
        transition: "box-shadow 0.2s, transform 0.2s",
        transform: hovered && hoverable ? "translateY(-2px)" : "none",
        cursor: onClick ? "pointer" : "default", ...style,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
};

// ── Circular Nav Button ──
const CircleButton = ({ children, onClick, size = 36, style = {} }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      style={{
        width: size, height: size, borderRadius: "50%", backgroundColor: hovered ? colors.white : colors.lightGray,
        border: "none", display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.2s", boxShadow: hovered ? shadows.hover : "none", ...style,
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
};

// ── Status Progress Bar ──
const StatusProgress = ({ currentStatus }) => {
  const steps = ["pending", "order_confirmed", "picked_up", "delivering", "completed"];
  const labels = ["주문접수", "주문확인", "픽업완료", "배달중", "배달완료"];
  const currentIdx = steps.indexOf(currentStatus);
  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        {steps.map((step, i) => (
          <div key={step} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: i <= currentIdx ? colors.rauschRed : colors.lightGray,
              color: i <= currentIdx ? colors.white : colors.disabledText,
              fontSize: 11, fontWeight: 600, transition: "all 0.3s",
            }}>
              {i < currentIdx ? Icons.check : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: "0 4px", backgroundColor: i < currentIdx ? colors.rauschRed : colors.lightGray, transition: "all 0.3s" }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {labels.map((label, i) => (
          <span key={label} style={{ fontSize: 10, color: i <= currentIdx ? colors.nearBlack : colors.disabledText, fontWeight: i === currentIdx ? 600 : 400, textAlign: "center", width: 48 }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════
// PAGE: Home (메인 홈페이지)
// ══════════════════════════════════════════════════
const HomePage = ({ navigate, cartCount }) => {
  const [activeTab, setActiveTab] = useState("restaurant");
  const [expanded, setExpanded] = useState(null);
  const [region, setRegion] = useState("한경면");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.white }}>
      {/* Sticky Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: colors.white, borderBottom: `1px solid ${colors.lightGray}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 20px" }}>
          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.nearBlack, margin: 0, letterSpacing: -0.44 }}>한경배달</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                {Icons.location}
                <span style={{ fontSize: 14, color: colors.secondaryGray, fontWeight: 500 }}>{region}</span>
                <svg width="12" height="12" fill="none" stroke={colors.secondaryGray} strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <CircleButton onClick={() => navigate("my-orders")}>{Icons.orders}</CircleButton>
              <div style={{ position: "relative" }}>
                <CircleButton onClick={() => navigate("checkout")}>{Icons.cart}</CircleButton>
                {cartCount > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, backgroundColor: colors.rauschRed, color: colors.white, fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${colors.white}` }}>
                    {cartCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tab Pills (Airbnb category pill bar style) */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {[{ key: "restaurant", label: "맛집", icon: "🍽️" }, { key: "convenience_store", label: "편의점", icon: "🏪" }].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px 0", border: "none", borderRadius: radius.sm, fontSize: 15, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s",
                  backgroundColor: activeTab === tab.key ? colors.nearBlack : colors.lightGray,
                  color: activeTab === tab.key ? colors.white : colors.secondaryGray,
                }}
              >
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Category Scroll (Airbnb horizontal pill scroll) */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 20px 0", overflowX: "auto", display: "flex", gap: 12 }}>
        {mockCategories.map(cat => (
          <div key={cat.name} onClick={() => setExpanded(expanded === cat.name ? null : cat.name)} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 68, cursor: "pointer", opacity: expanded && expanded !== cat.name ? 0.5 : 1, transition: "opacity 0.2s" }}>
            <div style={{ width: 56, height: 56, borderRadius: radius.md, overflow: "hidden", border: expanded === cat.name ? `2px solid ${colors.nearBlack}` : "2px solid transparent", transition: "border 0.2s" }}>
              <img src={cat.image} alt={cat.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: expanded === cat.name ? 700 : 500, color: colors.nearBlack, marginTop: 6, borderBottom: expanded === cat.name ? `2px solid ${colors.nearBlack}` : "2px solid transparent", paddingBottom: 2 }}>
              {cat.name}
            </span>
          </div>
        ))}
      </div>

      {/* Restaurant List */}
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 20px 100px" }}>
        {mockCategories.map(cat => {
          const isExpanded = expanded === cat.name || expanded === null;
          const restaurants = mockRestaurants[cat.name] || [];
          if (!isExpanded && expanded !== null) return null;

          return (
            <div key={cat.name} style={{ marginBottom: 12 }}>
              <Card style={{ overflow: "hidden" }}>
                {/* Category Header */}
                <div
                  onClick={() => setExpanded(expanded === cat.name ? null : cat.name)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <img src={cat.image} alt={cat.name} style={{ width: 52, height: 36, borderRadius: radius.sm, objectFit: "cover" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: colors.nearBlack }}>{cat.name}</span>
                      <span style={{ fontSize: 13, color: colors.disabledText }}>{cat.count}곳</span>
                      {cat.openCount > 0 && <Badge color="green">{cat.openCount}곳 배달가능</Badge>}
                    </div>
                  </div>
                  <div style={{ transform: expanded === cat.name ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                    {Icons.chevronDown}
                  </div>
                </div>

                {/* Expanded Restaurant List */}
                {expanded === cat.name && restaurants.length > 0 && (
                  <div style={{ borderTop: `1px solid ${colors.lightGray}` }}>
                    {restaurants.map((r, i) => (
                      <div
                        key={r.id}
                        onClick={() => r.isOpen && navigate("restaurant")}
                        style={{
                          display: "flex", alignItems: "center", padding: "12px 16px",
                          borderBottom: i < restaurants.length - 1 ? `1px solid ${colors.lightGray}` : "none",
                          opacity: r.isOpen ? 1 : 0.45, cursor: r.isOpen ? "pointer" : "default",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => r.isOpen && (e.currentTarget.style.backgroundColor = colors.lightGray)}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 500, color: colors.nearBlack, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                            {r.isRecommended && <Badge color="yellow">추천</Badge>}
                            {r.isHot && <Badge color="red">Hot</Badge>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            {Icons.clock}
                            <span style={{ fontSize: 13, color: colors.secondaryGray }}>{r.hours}</span>
                          </div>
                          {r.description && r.isOpen && (
                            <p style={{ fontSize: 13, color: colors.secondaryGray, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</p>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 12 }}>
                          <span style={{ fontSize: 13, color: colors.secondaryGray }}>{r.distance}km</span>
                          {r.isOpen ? (
                            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: colors.green }} />
                          ) : (
                            <span style={{ fontSize: 12, color: colors.rauschRed, fontWeight: 500 }}>준비중</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </main>
    </div>
  );
};

// ══════════════════════════════════════════════════
// PAGE: Restaurant Detail (식당 상세)
// ══════════════════════════════════════════════════
const RestaurantPage = ({ navigate, cart, setCart }) => {
  const restaurant = { name: "할머니 손맛 설렁탕", category: "한식", hours: "10:00-21:00", phone: "064-123-4567", rating: 4.7, description: "40년 전통의 사골설렁탕 전문점입니다. 매일 아침 새로 우려낸 사골육수를 사용합니다." };

  const addToCart = (menu) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === menu.id);
      if (existing) return prev.map(i => i.id === menu.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...menu, qty: 1 }];
    });
  };

  const removeFromCart = (menuId) => {
    setCart(prev => {
      const item = prev.find(i => i.id === menuId);
      if (item && item.qty > 1) return prev.map(i => i.id === menuId ? { ...i, qty: i.qty - 1 } : i);
      return prev.filter(i => i.id !== menuId);
    });
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.white, paddingBottom: cartCount > 0 ? 100 : 20 }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: colors.white, borderBottom: `1px solid ${colors.lightGray}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center" }}>
          <CircleButton onClick={() => navigate("home")}>{Icons.back}</CircleButton>
          <h1 style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600, color: colors.nearBlack, margin: 0, letterSpacing: -0.18 }}>{restaurant.name}</h1>
          <div style={{ width: 36 }} />
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 20px" }}>
        {/* Restaurant Info Card */}
        <Card style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <Badge color="gray">{restaurant.category}</Badge>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                {Icons.clock}
                <span style={{ fontSize: 14, color: colors.secondaryGray }}>영업시간 {restaurant.hours}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                {Icons.phone}
                <span style={{ fontSize: 14, color: colors.secondaryGray }}>{restaurant.phone}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: colors.yellowBg, padding: "6px 12px", borderRadius: radius.lg }}>
              {Icons.star}
              <span style={{ fontSize: 15, fontWeight: 600, color: colors.nearBlack }}>{restaurant.rating}</span>
            </div>
          </div>
          <p style={{ fontSize: 14, color: colors.secondaryGray, marginTop: 12, lineHeight: 1.5 }}>{restaurant.description}</p>
        </Card>

        {/* Menu Section */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.nearBlack, marginBottom: 16, letterSpacing: -0.18 }}>메뉴</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mockMenus.map(menu => {
            const cartItem = cart.find(i => i.id === menu.id);
            return (
              <Card key={menu.id} style={{ padding: 16 }} hoverable>
                <div style={{ display: "flex", gap: 14 }}>
                  {menu.image && (
                    <img src={menu.image} alt={menu.name} style={{ width: 88, height: 88, borderRadius: radius.md, objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: colors.nearBlack }}>{menu.name}</span>
                    {menu.description && (
                      <span style={{ fontSize: 13, color: colors.secondaryGray, marginTop: 4, lineHeight: 1.4 }}>{menu.description}</span>
                    )}
                    <span style={{ fontSize: 15, fontWeight: 600, color: colors.nearBlack, marginTop: "auto", paddingTop: 8 }}>₩{menu.price.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", alignSelf: "center" }}>
                    {cartItem ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CircleButton onClick={() => removeFromCart(menu.id)} size={32}>{Icons.minus}</CircleButton>
                        <span style={{ fontSize: 15, fontWeight: 600, color: colors.nearBlack, width: 20, textAlign: "center" }}>{cartItem.qty}</span>
                        <CircleButton onClick={() => addToCart(menu)} size={32} style={{ backgroundColor: colors.nearBlack }}><svg width="16" height="16" fill="none" stroke={colors.white} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg></CircleButton>
                      </div>
                    ) : (
                      <Button variant="primary" onClick={() => addToCart(menu)} style={{ height: 36, fontSize: 14, padding: "0 16px" }}>담기</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Floating Cart Bar */}
      {cartCount > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTop: `1px solid ${colors.lightGray}`, padding: "12px 0", zIndex: 20 }}>
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
            <button
              onClick={() => navigate("checkout")}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                backgroundColor: colors.rauschRed, color: colors.white, padding: "14px 20px",
                borderRadius: radius.sm, border: "none", cursor: "pointer", fontSize: 16, fontWeight: 600,
                transition: "background 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ backgroundColor: "rgba(255,255,255,0.25)", padding: "3px 10px", borderRadius: radius.lg, fontSize: 14, fontWeight: 700 }}>{cartCount}</span>
                <span>장바구니 보기</span>
              </div>
              <span style={{ fontWeight: 700 }}>₩{cartTotal.toLocaleString()}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════
// PAGE: Store Detail (편의점 상세)
// ══════════════════════════════════════════════════
const StorePage = ({ navigate, cart, setCart }) => {
  const [selectedCat, setSelectedCat] = useState("all");
  const store = { name: "CU 한경점", brandName: "CU", hours24: true, phone: "064-987-6543", address: "한경면 한경로 22" };
  const products = [
    { id: "p1", name: "코카콜라 500ml", price: 1800, category: "음료", ageRestriction: "none", stock: 20 },
    { id: "p2", name: "새우깡", price: 1500, category: "과자", ageRestriction: "none", stock: 15 },
    { id: "p3", name: "참이슬", price: 1800, category: "주류", ageRestriction: "adult", stock: 30 },
    { id: "p4", name: "삼각김밥 참치", price: 1200, category: "도시락", ageRestriction: "none", stock: 8 },
    { id: "p5", name: "바나나우유", price: 1500, category: "유제품", ageRestriction: "none", stock: 3 },
    { id: "p6", name: "신라면", price: 1200, category: "라면", ageRestriction: "none", stock: 0 },
  ];
  const categories = ["all", "음료", "과자", "주류", "도시락", "유제품", "라면"];
  const catLabels = { all: "전체", "음료": "음료", "과자": "과자/스낵", "주류": "주류", "도시락": "간편식", "유제품": "유제품", "라면": "라면" };
  const filtered = selectedCat === "all" ? products : products.filter(p => p.category === selectedCat);

  const addToCart = (p) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };
  const removeFromCart = (id) => {
    setCart(prev => {
      const it = prev.find(i => i.id === id);
      if (it && it.qty > 1) return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
      return prev.filter(i => i.id !== id);
    });
  };
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.white, paddingBottom: cartCount > 0 ? 100 : 20 }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: colors.white, borderBottom: `1px solid ${colors.lightGray}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center" }}>
          <CircleButton onClick={() => navigate("home")}>{Icons.back}</CircleButton>
          <h1 style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600, color: colors.nearBlack, margin: 0 }}>{store.name}</h1>
          <div style={{ width: 36 }} />
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "16px 20px" }}>
        {/* Store Info */}
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Badge color="green">{store.brandName}</Badge>
            <Badge color="blue">24시간</Badge>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            {Icons.phone}
            <span style={{ fontSize: 14, color: colors.secondaryGray }}>{store.phone}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            {Icons.location}
            <span style={{ fontSize: 14, color: colors.secondaryGray }}>{store.address}</span>
          </div>
        </Card>

        {/* Category Pills (Airbnb horizontal scroll) */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 8 }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCat(c)}
              style={{
                padding: "8px 16px", borderRadius: radius.xl, border: selectedCat === c ? `2px solid ${colors.nearBlack}` : `1px solid ${colors.borderGray}`,
                backgroundColor: selectedCat === c ? colors.nearBlack : colors.white,
                color: selectedCat === c ? colors.white : colors.nearBlack,
                fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {catLabels[c]}
            </button>
          ))}
        </div>

        {/* Product List */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.nearBlack, marginBottom: 16, letterSpacing: -0.18 }}>
          상품 <span style={{ fontSize: 14, fontWeight: 400, color: colors.secondaryGray }}>({filtered.length})</span>
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(p => {
            const cartItem = cart.find(i => i.id === p.id);
            const outOfStock = p.stock <= 0;
            return (
              <Card key={p.id} style={{ padding: 16, opacity: outOfStock ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: colors.nearBlack }}>{p.name}</span>
                      {p.ageRestriction === "adult" && <Badge color="red">19+</Badge>}
                      {p.stock <= 5 && p.stock > 0 && <Badge color="yellow">{p.stock}개 남음</Badge>}
                      {outOfStock && <Badge color="gray">품절</Badge>}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: colors.nearBlack, marginTop: 6, display: "block" }}>₩{p.price.toLocaleString()}</span>
                  </div>
                  {!outOfStock && (
                    cartItem ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CircleButton onClick={() => removeFromCart(p.id)} size={32}>{Icons.minus}</CircleButton>
                        <span style={{ fontSize: 15, fontWeight: 600, width: 20, textAlign: "center" }}>{cartItem.qty}</span>
                        <CircleButton onClick={() => addToCart(p)} size={32} style={{ backgroundColor: colors.nearBlack }}><svg width="16" height="16" fill="none" stroke={colors.white} strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg></CircleButton>
                      </div>
                    ) : (
                      <Button variant="primary" onClick={() => addToCart(p)} style={{ height: 36, fontSize: 14, padding: "0 16px" }}>담기</Button>
                    )
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {cartCount > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: colors.white, borderTop: `1px solid ${colors.lightGray}`, padding: "12px 0", zIndex: 20 }}>
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
            <button onClick={() => navigate("checkout")} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.rauschRed, color: colors.white, padding: "14px 20px", borderRadius: radius.sm, border: "none", cursor: "pointer", fontSize: 16, fontWeight: 600 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ backgroundColor: "rgba(255,255,255,0.25)", padding: "3px 10px", borderRadius: radius.lg, fontSize: 14, fontWeight: 700 }}>{cartCount}</span>
                <span>장바구니 보기</span>
              </div>
              <span style={{ fontWeight: 700 }}>₩{cartTotal.toLocaleString()}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════
// PAGE: Checkout (체크아웃)
// ══════════════════════════════════════════════════
const CheckoutPage = ({ navigate, cart, setCart }) => {
  const [phone, setPhone] = useState("010-1234-5678");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = subtotal > 0 ? 3000 : 0;
  const total = subtotal + deliveryFee;

  const inputStyle = {
    width: "100%", padding: "14px 16px", borderRadius: radius.sm, border: `1px solid ${colors.borderGray}`,
    fontSize: 15, color: colors.nearBlack, outline: "none", boxSizing: "border-box",
    fontFamily: "inherit", transition: "border 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.white }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: colors.white, borderBottom: `1px solid ${colors.lightGray}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center" }}>
          <CircleButton onClick={() => navigate("restaurant")}>{Icons.back}</CircleButton>
          <h1 style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600, color: colors.nearBlack, margin: 0 }}>주문하기</h1>
          <div style={{ width: 36 }} />
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px" }}>
        {/* Cart Items */}
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.nearBlack, marginBottom: 16, letterSpacing: -0.18 }}>주문 내역</h2>
          {cart.length === 0 ? (
            <p style={{ color: colors.secondaryGray, textAlign: "center", padding: 20 }}>장바구니가 비어있습니다</p>
          ) : (
            <div>
              {cart.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${colors.lightGray}` }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 500, color: colors.nearBlack }}>{item.name}</span>
                    <span style={{ fontSize: 14, color: colors.secondaryGray, marginLeft: 8 }}>x{item.qty}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: colors.nearBlack }}>₩{(item.price * item.qty).toLocaleString()}</span>
                    <CircleButton onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} size={28}>
                      <svg width="14" height="14" fill="none" stroke={colors.secondaryGray} strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg>
                    </CircleButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Delivery Info */}
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.nearBlack, marginBottom: 16, letterSpacing: -0.18 }}>배달 정보</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: colors.nearBlack, marginBottom: 6, display: "block" }}>연락처</label>
              <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: colors.nearBlack, marginBottom: 6, display: "block" }}>이름 (선택)</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="주문자 이름" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: colors.nearBlack, marginBottom: 6, display: "block" }}>배달 주소</label>
              <input style={inputStyle} value={address} onChange={e => setAddress(e.target.value)} placeholder="한경면 신한로 123" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: colors.nearBlack, marginBottom: 6, display: "block" }}>요청사항</label>
              <textarea style={{ ...inputStyle, height: 80, resize: "none" }} value={memo} onChange={e => setMemo(e.target.value)} placeholder="배달 시 참고사항을 입력해주세요" />
            </div>
          </div>
        </Card>

        {/* Payment Summary */}
        <Card style={{ padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.nearBlack, marginBottom: 16, letterSpacing: -0.18 }}>결제 금액</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: colors.secondaryGray }}>
              <span>음식 금액</span><span>₩{subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: colors.secondaryGray }}>
              <span>배달비</span><span>₩{deliveryFee.toLocaleString()}</span>
            </div>
            <div style={{ borderTop: `1px solid ${colors.lightGray}`, paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: colors.nearBlack }}>
              <span>총 결제금액</span><span>₩{total.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Pay Button */}
        <Button variant="brand" fullWidth onClick={() => navigate("order-detail")} disabled={cart.length === 0 || !address} style={{ height: 56, fontSize: 18, fontWeight: 700, borderRadius: radius.sm }}>
          ₩{total.toLocaleString()} 결제하기
        </Button>
      </main>
    </div>
  );
};

// ══════════════════════════════════════════════════
// PAGE: My Orders (주문내역)
// ══════════════════════════════════════════════════
const MyOrdersPage = ({ navigate }) => {
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);

  const statusLabels = { pending: "주문접수", order_confirmed: "주문확인", picked_up: "픽업완료", delivering: "배달중", completed: "배달완료", cancelled: "취소" };
  const statusColors = { pending: "yellow", order_confirmed: "green", picked_up: "purple", delivering: "blue", completed: "gray", cancelled: "red" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.white }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: colors.white, borderBottom: `1px solid ${colors.lightGray}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center" }}>
          <CircleButton onClick={() => navigate("home")}>{Icons.back}</CircleButton>
          <h1 style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600, color: colors.nearBlack, margin: 0 }}>주문내역</h1>
          <div style={{ width: 36 }} />
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px" }}>
        {/* Search Card */}
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              style={{ flex: 1, padding: "12px 16px", borderRadius: radius.sm, border: `1px solid ${colors.borderGray}`, fontSize: 15, outline: "none", fontFamily: "inherit" }}
              placeholder="전화번호 입력"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <Button variant="primary" onClick={() => setSearched(true)} disabled={!phone} style={{ height: 48, padding: "0 20px" }}>조회</Button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <span style={{ fontSize: 14, color: colors.secondaryGray }}>주문일자:</span>
            <input type="date" defaultValue="2026-04-04" style={{ padding: "8px 12px", borderRadius: radius.sm, border: `1px solid ${colors.borderGray}`, fontSize: 14, fontFamily: "inherit" }} />
            <button style={{ padding: "8px 14px", borderRadius: radius.xl, border: "none", backgroundColor: colors.rauschRed, color: colors.white, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>오늘</button>
          </div>
        </Card>

        {/* Results */}
        {searched && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {mockOrders.map(group => (
              <Card key={group.id} style={{ overflow: "hidden" }} hoverable onClick={() => navigate("order-detail")}>
                <div style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Badge color={statusColors[group.status]}>{statusLabels[group.status]}</Badge>
                        <span style={{ fontSize: 13, color: colors.secondaryGray }}>{group.orders.length}곳</span>
                      </div>
                      <p style={{ fontSize: 14, color: colors.secondaryGray, margin: "4px 0" }}>{group.address}</p>
                      <p style={{ fontSize: 13, color: colors.disabledText }}>
                        {new Date(group.createdAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: colors.nearBlack }}>₩{group.totalAmount.toLocaleString()}</span>
                  </div>
                  <StatusProgress currentStatus={group.status} />
                </div>
              </Card>
            ))}
          </div>
        )}

        {searched && mockOrders.length === 0 && (
          <Card style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: colors.secondaryGray, fontSize: 15 }}>주문 내역이 없습니다</p>
          </Card>
        )}
      </main>
    </div>
  );
};

// ══════════════════════════════════════════════════
// PAGE: Order Detail (주문 상세/추적)
// ══════════════════════════════════════════════════
const OrderDetailPage = ({ navigate }) => {
  const order = mockOrders[0];
  const detail = {
    orderNumber: "HKD-0412-001",
    status: "delivering",
    restaurant: "할머니 손맛 설렁탕",
    address: "한경면 신한로 123",
    estimatedTime: 35,
    driver: { name: "김기사", phone: "010-9876-5432" },
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: colors.white }}>
      <header style={{ backgroundColor: colors.white, borderBottom: `1px solid ${colors.lightGray}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center" }}>
          <CircleButton onClick={() => navigate("my-orders")}>{Icons.back}</CircleButton>
          <h1 style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600, color: colors.nearBlack, margin: 0 }}>주문 상태</h1>
          <div style={{ width: 36 }} />
        </div>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "20px" }}>
        {/* Status & Order Number */}
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 13, color: colors.secondaryGray, margin: 0 }}>주문번호</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: colors.nearBlack, margin: "4px 0 0", letterSpacing: -0.18 }}>{detail.orderNumber}</p>
            </div>
            <Badge color="blue" style={{ fontSize: 14, padding: "6px 14px" }}>배달중</Badge>
          </div>
          <StatusProgress currentStatus={detail.status} />

          {/* Restaurant */}
          <div style={{ borderTop: `1px solid ${colors.lightGray}`, paddingTop: 16, marginTop: 8 }}>
            <p style={{ fontSize: 13, color: colors.secondaryGray, margin: "0 0 4px" }}>식당</p>
            <p style={{ fontSize: 16, fontWeight: 500, color: colors.nearBlack, margin: 0 }}>{detail.restaurant}</p>
          </div>

          {/* Address */}
          <div style={{ borderTop: `1px solid ${colors.lightGray}`, paddingTop: 16, marginTop: 16 }}>
            <p style={{ fontSize: 13, color: colors.secondaryGray, margin: "0 0 4px" }}>배달 주소</p>
            <p style={{ fontSize: 16, fontWeight: 500, color: colors.nearBlack, margin: 0 }}>{detail.address}</p>
          </div>

          {/* Estimated Time */}
          <div style={{ borderTop: `1px solid ${colors.lightGray}`, paddingTop: 16, marginTop: 16 }}>
            <p style={{ fontSize: 13, color: colors.secondaryGray, margin: "0 0 4px" }}>예상 배달 시간</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.rauschRed, margin: 0 }}>약 {detail.estimatedTime}분</p>
          </div>

          {/* Driver */}
          <div style={{ borderTop: `1px solid ${colors.lightGray}`, paddingTop: 16, marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, color: colors.secondaryGray, margin: "0 0 4px" }}>배달기사</p>
              <p style={{ fontSize: 16, fontWeight: 500, color: colors.nearBlack, margin: 0 }}>{detail.driver.name}</p>
            </div>
            <Button variant="secondary" style={{ height: 40, fontSize: 14, gap: 6 }}>
              {Icons.phone}
              <span>{detail.driver.phone}</span>
            </Button>
          </div>
        </Card>

        {/* Pickup Progress (Multi-restaurant) */}
        {order.pickupProgress && (
          <Card style={{ padding: 20, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.nearBlack, marginBottom: 16, letterSpacing: -0.18 }}>픽업 진행률</h2>
            {/* Progress Bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: colors.secondaryGray, marginBottom: 6 }}>
                <span>{order.pickupProgress.picked}/{order.pickupProgress.total}곳 픽업</span>
                <span>{Math.round((order.pickupProgress.picked / order.pickupProgress.total) * 100)}%</span>
              </div>
              <div style={{ width: "100%", height: 8, backgroundColor: colors.lightGray, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${(order.pickupProgress.picked / order.pickupProgress.total) * 100}%`, height: "100%", backgroundColor: colors.rauschRed, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
            </div>
            {/* Checklist */}
            {order.pickupProgress.details.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${colors.lightGray}` }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: d.picked ? colors.greenBg : colors.lightGray, color: d.picked ? colors.green : colors.disabledText, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d.picked ? Icons.check : <span style={{ fontSize: 14 }}>·</span>}
                </div>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: d.picked ? colors.nearBlack : colors.secondaryGray }}>{d.name}</span>
                <span style={{ fontSize: 13, color: d.picked ? colors.green : colors.disabledText }}>{d.picked ? "픽업완료" : "대기중"}</span>
              </div>
            ))}
          </Card>
        )}

        {/* Order Items */}
        <Card style={{ padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.nearBlack, marginBottom: 16, letterSpacing: -0.18 }}>주문 내역</h2>
          {order.orders.map(o => (
            <div key={o.orderNumber} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: colors.nearBlack }}>{o.restaurant}</span>
                <span style={{ fontSize: 13, color: colors.secondaryGray }}>#{o.orderNumber}</span>
              </div>
              {o.items.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: colors.secondaryGray, padding: "4px 0" }}>
                  <span>{item.name} x{item.qty}</span>
                  <span>₩{item.price.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${colors.lightGray}`, paddingTop: 12, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: colors.secondaryGray, marginBottom: 6 }}>
              <span>음식 금액</span><span>₩{(order.totalAmount - 3000).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: colors.secondaryGray, marginBottom: 6 }}>
              <span>배달비</span><span>₩3,000</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: colors.nearBlack }}>
              <span>총 결제금액</span><span>₩{order.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </Card>

        {/* Order Time */}
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: colors.secondaryGray }}>주문 시간</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: colors.nearBlack }}>
              {new Date(order.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </Card>

        <Button variant="secondary" fullWidth onClick={() => navigate("home")} style={{ marginBottom: 20 }}>홈으로 돌아가기</Button>
      </main>
    </div>
  );
};

// ══════════════════════════════════════════════════
// ROOT APP - Navigation Controller
// ══════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("home");
  const [cart, setCart] = useState([]);

  const navigate = (p) => setPage(p);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Page navigation bar
  const NavBar = () => (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: colors.rauschRed }}>
      <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 12px", overflowX: "auto" }}>
        {[
          { key: "home", label: "홈" },
          { key: "restaurant", label: "식당상세" },
          { key: "store", label: "편의점" },
          { key: "checkout", label: "체크아웃" },
          { key: "my-orders", label: "주문내역" },
          { key: "order-detail", label: "주문추적" },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPage(p.key)}
            style={{
              padding: "6px 12px", borderRadius: radius.xl, border: "none",
              backgroundColor: page === p.key ? colors.white : "rgba(255,255,255,0.2)",
              color: page === p.key ? colors.rauschRed : colors.white,
              fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif", color: colors.nearBlack, paddingTop: 40 }}>
      <NavBar />
      {page === "home" && <HomePage navigate={navigate} cartCount={cartCount} />}
      {page === "restaurant" && <RestaurantPage navigate={navigate} cart={cart} setCart={setCart} />}
      {page === "store" && <StorePage navigate={navigate} cart={cart} setCart={setCart} />}
      {page === "checkout" && <CheckoutPage navigate={navigate} cart={cart} setCart={setCart} />}
      {page === "my-orders" && <MyOrdersPage navigate={navigate} />}
      {page === "order-detail" && <OrderDetailPage navigate={navigate} />}
    </div>
  );
}
