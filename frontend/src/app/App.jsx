import { useEffect, useState } from "react";
import Icon from "../components/ui/Icon";
import CreateEventPage from "../features/events/CreateEventPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import HelpPage from "../features/help/HelpPage";
import ReportsPage from "../features/reports/ReportsPage";
import SearchStudentsPage from "../features/students/SearchStudentsPage";
import SettingsPage from "../features/settings/SettingsPage";
import { initials } from "../lib/format";

const MAIN_NAV = [
  { label: "Dashboard", icon: "grid" },
  { label: "Reports", icon: "rep" },
  { label: "Create Event", icon: "cal" },
  { label: "Students", icon: "usr" },
];

const GENERAL_NAV = [
  { label: "Settings", icon: "set" },
  { label: "Help", icon: "hlp" },
];

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState({
    name: "Ino Garcia",
    email: "ino@gmail.com",
  });
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = setTimeout(() => setToastMessage(""), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const navigate = (nextPage) => {
    setPage(nextPage);
    setSidebarOpen(false);
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
      {label}
    </button>
  );

  if (signedOut) {
    return (
      <div className="app out">
        <div className="card done">
          <h2 style={{ fontSize: 18 }}>You're signed out</h2>
          <p style={{ margin: "4px 0 16px" }}>
            See you next time, {user.name.split(" ")[0]}.
          </p>
          <button
            type="button"
            className="btn p"
            onClick={() => {
              setSignedOut(false);
              setPage("Dashboard");
            }}
          >
            Sign in again
          </button>
        </div>
      </div>
    );
  }

  const pages = {
    Dashboard: <DashboardPage />,
    Reports: <ReportsPage toast={setToastMessage} />,
    "Create Event": <CreateEventPage />,
    "Search Students": <SearchStudentsPage />,
    Settings: (
      <SettingsPage
        user={user}
        setUser={setUser}
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
            AttendX
          </div>
          <div className="grp">Menu</div>
          {MAIN_NAV.map(renderNavItem)}
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
            Logout
          </button>
        </div>
      </aside>

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
          <button type="button" className="ib" aria-label="Notifications">
            <Icon name="bel" />
          </button>
          <button type="button" className="ib" aria-label="Messages">
            <Icon name="cht" />
          </button>
          <div className="me">
            <span className="av">{initials(user.name)}</span>
            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
          </div>
        </header>
        <main className="content">
          <div className="inner">{pages[page]}</div>
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
            <p>You'll need to sign in again to manage events.</p>
            <div className="acts">
              <button
                type="button"
                className="btn"
                onClick={() => setLogoutDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn p"
                onClick={() => {
                  setLogoutDialogOpen(false);
                  setSignedOut(true);
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
