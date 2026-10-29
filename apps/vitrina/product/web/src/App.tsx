/**
 * Vitrina app shell.
 *
 * Mobile-first Vitrina shell: logo, history/basket actions, bottom tabs,
 * and durable order/collection routes.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ensurePreviewAutoAuth } from './auth/supabaseClient';
import { Receipt, Compass, MessageCircle, ShoppingBasket, Store, User } from 'lucide-react';
import { BasketSheet } from './cart/BasketSheet';
import { subscribeBasketOpen } from './cart/basketViewer';
import { useCart, usePulse } from './cart/useCart';
import { ChatPage, type QueuedChatHandoff } from './chat/ChatPage';
import { ChatsDrawer } from './chat/ChatsDrawer';
import { clearActiveThreadId, type ChatThread } from './chat/threadsApi';
import { AddToBasketFlight } from './discover/AddToBasketFlight';
import { DiscoverPage } from './discover/DiscoverPage';
import { RecipeModal } from './discover/RecipeModal';
import { subscribeRecipeViewer } from './discover/recipeViewer';
import type { RecipeVideoDetail } from './discover/recipeVideosApi';
import { LocationModal } from './location/LocationModal';
import { useUserLocation, type UserLocation } from './location/useUserLocation';
import {
  WelcomeSplash,
  shouldShowWelcomeSplash,
} from './location/WelcomeSplash';
import LocationPage from './magic/LocationPage';
import CheckoutPage from './magic/CheckoutPage';
import { CheckoutSuccess } from './orders/CheckoutSuccess';
import { CollectPage } from './orders/CollectPage';
import { OrderDetail } from './orders/OrderDetail';
import { OrdersPage } from './orders/OrdersPage';
import { BrowsePage } from './shops/BrowsePage';
import type { Shop } from './api/types';
import { subscribeShopNavigator } from './shops/shopNavigator';
import { AuthSheet } from './auth/AuthSheet';
import { useAuth } from './auth/useAuth';

type AppTab = 'chat' | 'discover' | 'browse' | 'profile';

export default function App() {
  const [chatResetKey, setChatResetKey] = useState(0);
  const [chatStarted, setChatStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('discover');
  const [queuedHandoffs, setQueuedHandoffs] = useState<QueuedChatHandoff[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [browseFocusShop, setBrowseFocusShop] = useState<Shop | null>(null);
  const consumeBrowseFocus = useCallback(() => {
    setBrowseFocusShop(null);
  }, []);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationMandatory, setLocationMandatory] = useState(false);
  const [splashVisible, setSplashVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.location.pathname.startsWith('/location')) return false;
    if (window.location.pathname.startsWith('/checkout')) return false;
    return shouldShowWelcomeSplash();
  });
  const [activeRecipe, setActiveRecipe] = useState<RecipeVideoDetail | null>(null);
  const [flight, setFlight] = useState<{ posterUrl: string | null; recipeTitle: string } | null>(null);
  const [, setThreads] = useState<ChatThread[]>([]);
  const cart = useCart();
  const basketPulseAt = usePulse();
  const basketBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!basketPulseAt) return;
    const el = basketBtnRef.current;
    if (!el) return;
    el.classList.remove('is-pulsing');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('is-pulsing');
    const t = setTimeout(() => el.classList.remove('is-pulsing'), 520);
    return () => clearTimeout(t);
  }, [basketPulseAt]);
  const { location, setLocation } = useUserLocation();
  const locationResolver = useRef<((ok: boolean) => void) | null>(null);
  const path = typeof window === 'undefined' ? '/' : window.location.pathname;
  const orderDetailMatch = path.match(/^\/orders\/([^/]+)$/);
  const collectMatch = path.match(/^\/orders\/([^/]+)\/collect$/);
  const collectKey = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('k');

  // Mobile keyboard tracking: when visualViewport shrinks (keyboard
  // up), we want the bottom-nav to slide off so the chat composer can
  // dock above the keyboard. Header stays sticky regardless. The
  // `vitrina-keyboard-open` class on the root flips both CSS rules.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = window.innerHeight - vv.height;
      setKeyboardOpen(inset > 80);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // Preview auto-auth: silently sign in as Peter on Vercel previews so the
  // recipe → cart → payment flow can be dogfooded end-to-end without a
  // login interrupt. Production deploys leave the env flag unset.
  useEffect(() => {
    void ensurePreviewAutoAuth();
  }, []);

  // Location cold-load: every "buyable recipe" needs a location to match
  // shops + delivery, so we ask on cold load until the user has saved a
  // location. After first save, subsequent sessions reuse it silently.
  // While the welcome splash is up we hold off; the modal animates in
  // underneath once the splash finishes.
  // Magic-link routes (/location, /checkout) use their own full-page UI —
  // never stack the shell LocationModal on top of them.
  useEffect(() => {
    const p = typeof window !== 'undefined' ? window.location.pathname : '';
    if (p.startsWith('/location') || p.startsWith('/checkout')) return;
    if (splashVisible) return;
    if (location || locationOpen) return;
    if (typeof window === 'undefined') return;
    setLocationMandatory(true);
    setLocationOpen(true);
  }, [location, locationOpen, splashVisible]);

  function newChat() {
    // Drop the persisted thread BEFORE we remount, otherwise
    // useVitrinaChat would re-hydrate the same thread on the next
    // mount and "New chat" would feel like a no-op. The remount via
    // chatResetKey then gives us a clean slate.
    clearActiveThreadId();
    setChatStarted(false);
    setChatResetKey((k) => k + 1);
    setDrawerOpen(false);
    setBasketOpen(false);
    setBrowseFocusShop(null);
    setQueuedHandoffs([]);
    setActiveTab('chat');
  }

  function requireLocation() {
    if (location) return Promise.resolve(true);
    setLocationMandatory(true);
    setLocationOpen(true);
    return new Promise<boolean>((resolve) => {
      locationResolver.current = resolve;
    });
  }

  function confirmLocation(next: UserLocation) {
    setLocation(next);
    setLocationOpen(false);
    setLocationMandatory(false);
    locationResolver.current?.(true);
    locationResolver.current = null;
  }

  function cancelLocation() {
    if (locationMandatory) return;
    setLocationOpen(false);
    locationResolver.current?.(false);
    locationResolver.current = null;
  }

  const requireLocationRef = useRef(requireLocation);
  requireLocationRef.current = requireLocation;

  useEffect(() => {
    return subscribeRecipeViewer((detail) => setActiveRecipe(detail));
  }, []);

  useEffect(() => {
    return subscribeBasketOpen(() => setBasketOpen(true));
  }, []);

  useEffect(() => {
    return subscribeShopNavigator((shop) => {
      setBrowseFocusShop(shop);
      void requireLocationRef.current().then((ok) => {
        if (ok) setActiveTab('browse');
        else setBrowseFocusShop(null);
      });
    });
  }, []);

  return (
    <>
      <div
        className={`vitrina-app ${chatStarted ? 'vitrina-chat--active' : ''} ${keyboardOpen ? 'vitrina-keyboard-open' : ''}`}
      >
        <div style={{position:"fixed",top:64,left:0,right:0,zIndex:30,padding:"6px 14px",background:"#f3e4bb",textAlign:"center",fontSize:12}}>Demo recipes and fictional shops · Basket stays on this device</div>
        <header className="vitrina-app-chrome brand-glass--vellum">
          <button type="button" className="vitrina-wordmark" onClick={() => setActiveTab('discover')}>
            Vitrina
          </button>
          <div className="vitrina-top-actions">
            <button type="button" aria-label="Open orders" disabled onClick={() => setHistoryOpen(true)}>
              <Receipt size={19} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              ref={basketBtnRef}
              data-basket-target
              className="vitrina-basket-action"
              aria-label="Open basket"
              onClick={() => setBasketOpen(true)}
            >
              <ShoppingBasket size={19} strokeWidth={1.8} />
              {cart.totalItems > 0 ? <span>{cart.totalItems}</span> : null}
            </button>
          </div>
        </header>

        <ChatsDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onNewChat={newChat}
          onThreadsLoaded={setThreads}
        />
        <BasketSheet
          open={basketOpen}
          onClose={() => setBasketOpen(false)}
          onPaid={() => {
            setBasketOpen(false);
            setHistoryOpen(true);
          }}
          onDiscover={() => setActiveTab('discover')}
        />
        {historyOpen ? (
          <OrdersPage
            onBack={() => setHistoryOpen(false)}
            onDiscover={() => setActiveTab('discover')}
          />
        ) : null}
        <LocationModal
          open={locationOpen}
          initialLocation={location}
          onConfirm={confirmLocation}
          onCancel={cancelLocation}
          mandatory={locationMandatory}
        />
        {splashVisible ? <WelcomeSplash onDone={() => setSplashVisible(false)} /> : null}
        {activeRecipe ? (
          <RecipeModal
            detail={activeRecipe}
            onClose={() => setActiveRecipe(null)}
            onOpenBasket={() => setBasketOpen(true)}
            onChatPrompt={(prompt, attachment) => {
              void prompt; void attachment;
              setBasketOpen(true);
            }}
            onAddedToBasket={(posterUrl, recipeTitle) => {
              // Hoisted out of the modal so closing the modal doesn't
              // unmount the animation. The overlay plays ON TOP of the
              // chat tab, so Peter sees his message bubble appear and
              // the recipe "land" in the basket simultaneously.
              setFlight({ posterUrl, recipeTitle });
            }}
            onBuildBasket={(video) => {
              setQueuedHandoffs((q) => [
                ...q,
                {
                  prompt: `Add this real ${video.source} video to my Vitrina basket using live shop stock. Use the video URL and caption/title as source material, do not invent ingredients that are not implied by the video. Video: ${video.title} ${video.url}`,
                  attachment: null,
                },
              ]);
              setActiveTab('chat');
            }}
          />
        ) : null}
        {flight ? (
          <AddToBasketFlight
            posterUrl={flight.posterUrl}
            recipeTitle={flight.recipeTitle}
            onDone={() => setFlight(null)}
          />
        ) : null}
        <section className="vitrina-app-main">
          {/* Path-based full-screen routes override tab content */}
          {path === '/location' || path === '/location/' ? (
            <LocationPage />
          ) : path.startsWith('/checkout') && path !== '/checkout/success' ? (
            <CheckoutPage />
          ) : path === '/orders' ? (
            <OrdersPage onBack={() => { window.location.href = '/'; }} onDiscover={() => { window.location.href = '/'; }} />
          ) : orderDetailMatch ? (
            <OrderDetail orderId={decodeURIComponent(orderDetailMatch[1])} collectKey={collectKey} onBack={() => { window.location.href = '/orders'; }} />
          ) : collectMatch ? (
            <CollectPage orderId={decodeURIComponent(collectMatch[1])} collectKey={collectKey} onBack={() => { window.location.href = '/'; }} />
          ) : path === '/checkout/success' ? (
            <CheckoutSuccess onBack={() => { window.location.href = '/'; }} />
          ) : (
            <>
              {/* DiscoverPage is ALWAYS mounted so its feed, scroll position,
                  and prematch polling survive tab switches. Hidden via CSS when
                  another tab is active. display:contents is transparent to layout. */}
              <div style={{ display: activeTab === 'discover' ? 'contents' : 'none' }}>
                <DiscoverPage
                  location={location}
                  onBuildBasket={(video) => {
                    setQueuedHandoffs((q) => [
                      ...q,
                      {
                        prompt: `Add this real @owen.han ${video.source} video to my Vitrina basket using live shop stock. Use the video URL and caption/title as source material, do not invent ingredients that are not implied by the video. Video: ${video.title} ${video.url}`,
                        attachment: null,
                      },
                    ]);
                    setActiveTab('chat');
                  }}
                  onOpenBasket={() => setBasketOpen(true)}
                />
              </div>
              {/* Keep Chat mounted when switching Discover ↔ Chat (and while on Browse/Profile)
                  so useVitrinaChat state, SSE streaming, and hydration survive tab changes.
                  Previously Chat unmounted on Discover → null remount → Landing flash + lost loading. */}
              <div style={{ display: activeTab === 'chat' ? 'contents' : 'none' }}>
                <ChatPage
                  key={chatResetKey}
                  isActive={activeTab === 'chat'}
                  queuedHandoff={queuedHandoffs[0] ?? null}
                  onQueuedHandoffConsumed={() => {
                    setQueuedHandoffs((q) => q.slice(1));
                  }}
                  onFirstSend={async () => {
                    const ok = await requireLocation();
                    if (ok) setChatStarted(true);
                    return ok;
                  }}
                />
              </div>
              {activeTab === 'browse' ? (
                <BrowsePage
                  location={location}
                  focusShop={browseFocusShop}
                  onFocusShopConsumed={consumeBrowseFocus}
                />
              ) : activeTab === 'profile' ? (
                <ProfileTab
                  location={location}
                  onEditHomeAddress={() => {
                    setLocationMandatory(false);
                    setLocationOpen(true);
                  }}
                  totalItems={cart.totalItems}
                  totalEur={cart.totalEur}
                  onOpenHistory={() => setHistoryOpen(true)}
                />
              ) : null}
            </>
          )}
        </section>
        <aside className="vitrina-side-nav" aria-label="Primary (desktop)">
          <button type="button" className="vitrina-side-newchat" disabled onClick={newChat}>
            + New chat
          </button>
          <SideNavItem id="chat" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageCircle size={18} />} label="Chat" />
          <SideNavItem id="discover" active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} icon={<Compass size={18} />} label="Discover" />
          <SideNavItem
            id="browse"
            active={activeTab === 'browse'}
            onClick={() => {
              void requireLocation().then((ok) => {
                if (ok) setActiveTab('browse');
              });
            }}
            icon={<Store size={18} />}
            label="Browse"
          />
          <SideNavItem id="profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User size={18} />} label="Profile" />
          <button type="button" className="vitrina-side-history" onClick={() => setHistoryOpen(true)}>
            <Receipt size={16} strokeWidth={1.6} />
            <span>Orders</span>
          </button>
        </aside>
        <nav className="vitrina-bottom-nav" aria-label="Primary">
          <TabButton id="chat" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageCircle size={20} />} label="Chat" />
          <TabButton id="discover" active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} icon={<Compass size={20} />} label="Discover" />
          <TabButton
            id="browse"
            active={activeTab === 'browse'}
            onClick={() => {
              void requireLocation().then((ok) => {
                if (ok) setActiveTab('browse');
              });
            }}
            icon={<Store size={20} />}
            label="Browse"
          />
          <TabButton id="profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<User size={20} />} label="Profile" />
        </nav>
      </div>

      <style>{`
        html, body, #root {
          background: #f6f4ee;
        }
        /* Lighten the brand cream a notch and desaturate the yellow.
           Peter wants no gradient backgrounds anywhere — every page
           fills with this single token. Override the brand var here
           rather than touching the generated tokens.css. */
        :root, [data-theme] {
          --color-cream: #f6f4ee;
          --color-cream-dark: #ECE9DF;
        }
        /* All buttons default to 6px corners. Round shapes (icon-only,
           pills) opt back in via inline border-radius or component CSS. */
        button { border-radius: 6px; }
        .vitrina-app {
          display: block;
          min-height: 100dvh;
          background: #f6f4ee;
          color: #2a2420;
        }
        .vitrina-app-main {
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
        }
        /* Desktop three-pane shell at >=1024px:
           Sidebar nav | primary column (capped 760px) | contextual rail.
           Mobile/tablet falls back to the single-column bottom-nav. */
        .vitrina-side-nav { display: none; }
        @media (min-width: 1024px) {
          .vitrina-bottom-nav { display: none !important; }
          .vitrina-app-chrome { padding-bottom: 14px; }
          .vitrina-app {
            display: grid;
            grid-template-columns: 240px minmax(0, 1fr);
            gap: 24px;
            padding: calc(env(safe-area-inset-top, 0px) + 78px) 28px 32px;
            box-sizing: border-box;
          }
          .vitrina-app-chrome {
            grid-column: 1 / -1;
          }
          .vitrina-side-nav {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 12px;
            border-radius: 6px;
            background: rgba(255, 251, 242, 0.6);
            border: 1px solid rgba(60, 45, 30, 0.08);
            align-self: start;
            position: sticky;
            top: 96px;
            box-shadow: 0 18px 60px -42px rgba(60, 45, 30, 0.5);
          }
          .vitrina-side-newchat {
            all: unset;
            cursor: pointer;
            padding: 10px 12px;
            border-radius: 6px;
            margin-bottom: 6px;
            background: #2a2420;
            color: #faf5ec;
            font-size: 0.92rem;
            font-weight: 500;
            text-align: center;
          }
          .vitrina-side-item {
            all: unset;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border-radius: 6px;
            color: #6b5240;
            font-size: 0.92rem;
            transition: background 140ms ease;
          }
          .vitrina-side-item:hover { background: rgba(42, 36, 32, 0.05); }
          .vitrina-side-item.is-active {
            background: rgba(42, 36, 32, 0.08);
            color: #2a2420;
            font-weight: 600;
          }
          .vitrina-side-item__icon { display: grid; place-items: center; width: 22px; }
          .vitrina-side-history {
            all: unset;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 14px;
            padding: 8px 12px;
            border-top: 1px solid rgba(60, 45, 30, 0.08);
            color: #8a7560;
            font-size: 0.85rem;
          }
          .vitrina-app-main {
            min-height: calc(100dvh - 120px);
            max-width: 760px;
            margin: 0 auto;
            width: 100%;
          }
          .vitrina-discover-page,
          .vitrina-profile-tab {
            padding-top: 8px;
            padding-bottom: 28px;
          }
        }
        .vitrina-app-chrome {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: calc(env(safe-area-inset-top, 0px) + 16px) 18px 18px;
          pointer-events: none;
          /* Translucency = brand vellum (.brand-glass--vellum). We
             override the border (no hard divider — we want a soft
             fade into the page background), add a slight cream tinge
             on top of the vellum so the chrome reads as a warmer
             extension of the page rather than a cold glass slab, and
             push the bottom mask further down so the chrome stays
             solid through the wordmark + action pill before it begins
             dissolving. */
          border: 0;
          background-color: color-mix(in srgb, var(--color-cream, #f4ede1) 42%, transparent);
          /* Multi-stop mask so the chrome melts into the page instead of
             cutting off in a hard band. The wordmark + action pill still
             read solid (≈70%) before the fade ramps gently to transparent. */
          mask-image: linear-gradient(
            to bottom,
            #000 0%,
            #000 60%,
            rgba(0, 0, 0, 0.85) 75%,
            rgba(0, 0, 0, 0.55) 88%,
            rgba(0, 0, 0, 0.25) 96%,
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to bottom,
            #000 0%,
            #000 60%,
            rgba(0, 0, 0, 0.85) 75%,
            rgba(0, 0, 0, 0.55) 88%,
            rgba(0, 0, 0, 0.25) 96%,
            transparent 100%
          );
        }
        .vitrina-wordmark {
          pointer-events: auto;
          appearance: none;
          border: 0;
          background: transparent;
          padding: 0;
          color: #2a2420;
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 3.4vw, 2rem);
          font-weight: 400;
          line-height: 1;
          letter-spacing: -0.025em;
          cursor: pointer;
        }
        .vitrina-top-actions {
          pointer-events: auto;
          display: flex;
          gap: 4px;
          padding: 4px;
          border: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-card) 82%, transparent);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 18px 60px -42px rgba(60,45,30,0.65);
        }
        .vitrina-top-actions button {
          position: relative;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 999px;
          color: #2a2420;
          background: transparent;
          cursor: pointer;
        }
        .vitrina-top-actions .vitrina-basket-action {
          background: #2a2420;
          color: #f4ede1;
        }
        .vitrina-top-actions .vitrina-basket-action.is-pulsing {
          animation: vitrina-basket-icon-pulse 480ms ease-out;
        }
        @keyframes vitrina-basket-icon-pulse {
          0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(217,119,6,0.55); }
          40%  { transform: scale(1.16); box-shadow: 0 0 0 10px rgba(217,119,6,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217,119,6,0); }
        }
        .vitrina-top-actions button:hover,
        .vitrina-top-actions button:focus-visible {
          background: rgba(42,36,32,0.06);
          outline: none;
        }
        .vitrina-top-actions span {
          position: absolute;
          top: -2px;
          right: -1px;
          min-width: 18px;
          height: 18px;
          display: grid;
          place-items: center;
          padding: 0 4px;
          border-radius: 999px;
          background: #2a2420;
          color: #f4ede1;
          font-size: 11px;
          line-height: 1;
        }
        .vitrina-bottom-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 55;
          display: flex;
          justify-content: space-around;
          gap: 4px;
          /* iOS-tabbar proportions: ~62 px tall content + safe-area. The
             previous 4 px top/bottom padding squeezed icons + labels into
             a single line, which read as a debug strip rather than a
             primary navigation surface. */
          padding: 10px 20px calc(env(safe-area-inset-bottom, 0px) + 8px);
          border-top: 1px solid rgba(60,45,30,0.08);
          background: rgba(244,237,225,0.94);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          transform: translateY(0);
          transition: transform 180ms ease;
        }
        /* When the soft keyboard is up, the bottom-nav slides off so
           the chat composer can dock right above the keyboard. The
           header stays sticky regardless. */
        .vitrina-keyboard-open .vitrina-bottom-nav {
          transform: translateY(110%);
        }
        .vitrina-nav-item {
          appearance: none;
          border: 0;
          background: transparent;
          min-width: 64px;
          display: grid;
          justify-items: center;
          gap: 4px;
          color: #8a7560;
          font: inherit;
          font-size: 11px;
          letter-spacing: 0.01em;
          cursor: pointer;
        }
        .vitrina-nav-item svg { stroke-width: 1.7; width: 22px; height: 22px; }
        .vitrina-nav-item.is-active {
          color: #2a2420;
          font-weight: 600;
        }
        .vitrina-browse-tab {
          padding: 76px 0 86px;
          min-height: 100dvh;
          box-sizing: border-box;
        }
        .vitrina-browse-tab .vitrina-shops-page {
          min-height: auto;
          padding: 18px;
          grid-template-columns: 1fr;
        }
        .vitrina-browse-tab .vitrina-shops-cart,
        .vitrina-browse-tab .vitrina-shops-cart-pill {
          display: none;
        }
      `}</style>
    </>
  );
}

function SideNavItem({
  id,
  active,
  icon,
  label,
  onClick,
}: {
  id: AppTab;
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`vitrina-side-item ${active ? 'is-active' : ''}`}
      disabled={id !== 'discover'}
      onClick={onClick}
    >
      <span className="vitrina-side-item__icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TabButton({
  id,
  active,
  icon,
  label,
  onClick,
}: {
  id: AppTab;
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`vitrina-nav-item ${active ? 'is-active' : ''}`} disabled={id !== 'discover'} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ProfileTab({
  location,
  onEditHomeAddress,
  totalItems,
  totalEur,
  onOpenHistory,
}: {
  location: UserLocation | null;
  onEditHomeAddress: () => void;
  totalItems: number;
  totalEur: number;
  onOpenHistory: () => void;
}) {
  const { user, signOut, configured } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const avatarLetter =
    (user?.initials && user.initials.charAt(0).toUpperCase()) ||
    (location?.label?.trim() ? location.label.trim().charAt(0).toUpperCase() : '') ||
    '?';

  return (
    <section className="vitrina-profile-tab">
      <div className="vitrina-tab-header">
        <p>Profile</p>
        <h1>Your local taste</h1>
        <span>Preferences, order memory, and saved baskets will live here as Vitrina learns what you like.</span>
      </div>
      <div className="vitrina-profile-card">
        <div className="vitrina-profile-avatar">{avatarLetter}</div>
        <div>
          <strong>{user?.name ?? 'Guest'}</strong>
          <span>
            {user?.email ??
              (configured ? 'Not signed in · addresses stay on this device' : 'Sign-in not configured in this build')}
          </span>
        </div>
      </div>
      <div className="vitrina-profile-stats">
        <div><strong>{totalItems}</strong><span>basket items</span></div>
        <div><strong>€{totalEur.toFixed(2)}</strong><span>basket value</span></div>
        <div><strong>mem0</strong><span>memory on</span></div>
      </div>
      <button type="button" className="vitrina-profile-row" onClick={onEditHomeAddress}>
        <span>Home address</span>
        <em>{location?.label ?? 'Set where you cook from'}</em>
      </button>
      <button type="button" className="vitrina-profile-row" onClick={onOpenHistory}>
        <span>Your orders</span>
        <em>Open orders</em>
      </button>
      {configured && !user ? (
        <button type="button" className="vitrina-profile-row" onClick={() => setAuthOpen(true)}>
          <span>Sign in</span>
          <em>Sync basket &amp; home across devices</em>
        </button>
      ) : null}
      {user ? (
        <button
          type="button"
          className="vitrina-profile-logout"
          onClick={async () => {
            await signOut();
          }}
        >
          Log out
        </button>
      ) : null}
      {configured ? (
        <AuthSheet
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          intro="Sign in to sync your home address, basket, and orders across devices."
        />
      ) : null}
      <style>{`
        .vitrina-profile-tab {
          min-height: 100dvh;
          padding: 96px 18px 100px;
          box-sizing: border-box;
        }
        .vitrina-profile-tab > * {
          width: min(760px, 100%);
          margin-left: auto;
          margin-right: auto;
        }
        .vitrina-profile-card,
        .vitrina-profile-stats,
        .vitrina-profile-row {
          border: 1px solid rgba(60,45,30,0.1);
          background: rgba(255,251,242,0.58);
          border-radius: 6px;
          box-shadow: 0 18px 60px -44px rgba(60,45,30,0.6);
        }
        .vitrina-profile-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          margin-top: 18px;
        }
        .vitrina-profile-avatar {
          width: 56px;
          height: 56px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #2a2420;
          color: #f4ede1;
          font-family: var(--font-display);
          font-size: 1.7rem;
        }
        .vitrina-profile-card div:last-child { display: grid; gap: 3px; }
        .vitrina-profile-card strong { color: #2a2420; }
        .vitrina-profile-card span { color: #8a7560; font-size: .86rem; }
        .vitrina-profile-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 16px;
          margin-top: 12px;
        }
        .vitrina-profile-stats div { display: grid; gap: 3px; }
        .vitrina-profile-stats strong { font-family: var(--font-display); font-size: 1.45rem; color: #2a2420; }
        .vitrina-profile-stats span { color: #8a7560; font-size: .78rem; }
        .vitrina-profile-row {
          width: min(760px, 100%);
          margin-top: 12px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #2a2420;
          font: inherit;
          cursor: pointer;
        }
        .vitrina-profile-row em { color: #8a7560; font-style: normal; }
        .vitrina-profile-logout {
          width: min(760px, 100%);
          margin-top: 20px;
          padding: 14px 16px;
          border: 1px solid rgba(60,45,30,0.18);
          border-radius: 6px;
          background: transparent;
          color: #6b5240;
          font: inherit;
          font-size: 0.95rem;
          cursor: pointer;
        }
        .vitrina-profile-logout:hover,
        .vitrina-profile-logout:focus-visible {
          background: rgba(42,36,32,0.05);
          outline: none;
        }
      `}</style>
    </section>
  );
}
