import { useEffect, useState } from "react";
import Icon from "../components/ui/Icon";
import Avatar from "../components/ui/Avatar";
import ArchivePage from "../features/archive/ArchivePage";
import ActivityPage from "../features/activity/ActivityPage";
import CreateEventPage from "../features/events/CreateEventPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import ApprovalsPage from "../features/approvals/ApprovalsPage";
import HelpPage from "../features/help/HelpPage";
import LoginPage from "../features/auth/LoginPage";
import ReportsPage from "../features/reports/ReportsPage";
import SearchStudentsPage from "../features/students/SearchStudentsPage";
import SettingsPage from "../features/settings/SettingsPage";
import { clearSession, fetchMe, loadSession } from "../lib/api";

const MAIN_NAV = [
  { label: "Dashboard", icon: "grid" },
  { label: "Reports", icon: "rep" },
  { label: "Create Event", icon: "cal" },
  { label: "Students", icon: "usr" },
  { label: "Approvals", icon: "uc" },
  { label: "Archive", icon: "arc", superadminOnly: true },
  { label: "Activity", icon: "hist", superadminOnly: true },
];

const GENERAL_NAV = [
  { label: "Settings", icon: "set" },
  { label: "Help", icon: "hlp" },
];

export default function App() {
  const [session, setSession] = useState(() => loadSession());
  const [user, setUser] = useState(() => loadSession()?.user ?? null);
  const [checkingSession, setCheckingSession] = useState(Boolean(loadSession()));
  const [page, setPage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = setTimeout(() => setToastMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!session?.access_token) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;
    fetchMe()
      .then(({ user: profile }) => {
        if (cancelled) return;
        setUser(profile);
        setSession((current) => ({ ...current, user: profile }));
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
    // Validate the stored token once when the app starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (nextPage) => {
    setPage(nextPage);
    setSidebarOpen(false);
  };

  const handleLogin = (nextSession) => {
    setSession(nextSession);
    setUser(nextSession.user);
    setPage("Dashboard");
    setCheckingSession(false);
  };

  const signOut = () => {
    clearSession();
    setSession(null);
    setUser(null);
    setLogoutDialogOpen(false);
    setPage("Dashboard");
  };

  const renderNavItem = ({ label, icon }) => (
    <button
      type="button"
      key={label}
      className={"nav" + (page === label ? " on" : "")}
      aria-current={page === label ? "page" : undefined}
      onClick={() => navigate(label)}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );

  if (!session || !user) {
    if (checkingSession) {
      return (
        <div className="app out">
          <div className="card done" style={{ padding: "36px 32px", maxWidth: 360, width: "100%" }}>
            <div className="skeleton skel-title" style={{ width: "65%", margin: "0 auto 16px" }} />
            <div className="skeleton skel-text" style={{ width: "85%", margin: "0 auto 8px" }} />
            <div className="skeleton skel-text" style={{ width: "60%", margin: "0 auto" }} />
          </div>
        </div>
      );
    }
    return <LoginPage onLogin={handleLogin} />;
  }

  const isSuperadmin = user.role === "superadmin";
  const isStaff = isSuperadmin || user.role === "admin";

  if (!isStaff) {
    return (
      <div className="app out">
        <div className="card done" style={{ maxWidth: 440, padding: 36 }}>
          <div className="kpi-icon" style={{ margin: "0 auto 16px", background: "var(--warning-bg)", color: "var(--warning)" }}>
            <Icon name="inf" />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>Staff access only</h2>
          <p style={{ margin: "0 0 20px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            The web dashboard is for administrators. Students and organizers use the
            LacoQR mobile app to check in and scan.
          </p>
          <button type="button" className="btn p" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const mainNav = MAIN_NAV.filter((item) => !item.superadminOnly || isSuperadmin);

  const pages = {
    Dashboard: <DashboardPage onNavigate={navigate} user={user} toast={setToastMessage} />,
    Reports: <ReportsPage toast={setToastMessage} />,
    "Create Event": <CreateEventPage toast={setToastMessage} />,
    Students: <SearchStudentsPage user={user} toast={setToastMessage} />,
    Approvals: <ApprovalsPage />,
    Archive: <ArchivePage toast={setToastMessage} />,
    Activity: <ActivityPage />,
    Settings: (
      <SettingsPage
        user={{
          name: user.full_name,
          email: user.email,
          role: user.role,
        }}
        setUser={(next) =>
          setUser({ ...user, full_name: next.name, email: next.email })
        }
        toast={setToastMessage}
      />
    ),
    Help: <HelpPage />,
  };

  return (
    <div className="app">
      <aside className={"side" + (sidebarOpen ? " open" : "")}>
        <div className="side-top">
          <div className="brand">
            <span className="logo">
              <Icon name="grid" />
            </span>
            <span>LacoQR</span>
          </div>
          <div className="grp">Menu</div>
          {mainNav.map(renderNavItem)}
          <div className="grp">General</div>
          {GENERAL_NAV.map(renderNavItem)}
        </div>
        <div className="side-footer">
          <button
            type="button"
            className="nav"
            onClick={() => setLogoutDialogOpen(true)}
          >
            <Icon name="out" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className="main"
        onClick={() => sidebarOpen && setSidebarOpen(false)}
      >
        <header className="top">
          <button
            type="button"
            className="ib menu"
            aria-label="Open menu"
            onClick={(event) => {
              event.stopPropagation();
              setSidebarOpen(!sidebarOpen);
            }}
          >
            <Icon name="mnu" />
          </button>
          <div className="me">
            <Avatar name={user.full_name} photoUrl={user.photo_url} size="md" />
            <div>
              <b>{user.full_name}</b>
            </div>
            <span className="role-pill">{user.role}</span>
          </div>
        </header>
        <main className="content">
          <div className="inner" key={page}>
            {page === "Archive" || page === "Activity" ? (
              isSuperadmin ? pages[page] : pages.Dashboard
            ) : (
              pages[page] ?? pages.Dashboard
            )}
          </div>
        </main>
      </div>

      {logoutDialogOpen && (
        <div className="ov" onClick={() => setLogoutDialogOpen(false)}>
          <div
            className="dlg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="logout-title">Log out?</h2>
            <p>You will need to sign in again to manage events and attendance records.</p>
            <div className="acts">
              <button
                type="button"
                className="btn"
                onClick={() => setLogoutDialogOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn p" onClick={signOut}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast" role="status" key={toastMessage}>
          <Icon name="chk" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
