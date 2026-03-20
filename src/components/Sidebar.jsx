import { useAuth } from "../auth/AuthContext";

const NAV_ADMIN = [
  { id: "overview",        label: "Overview"           },
  { id: "textnorm",        label: "Text Normalization" },
  { id: "parallelnorm",    label: "Parallel Norm"      },
  { id: "datavalidation",  label: "Data Validation"    },
];

const NAV_STUDENT = [
  { id: "datavalidation",  label: "Data Validation"    },
  { id: "mystatus",        label: "My Status"          },
];

export default function Sidebar({ active, onSelect }) {
  const { logout, user } = useAuth();
  const items = user?.role === "admin" ? NAV_ADMIN : NAV_STUDENT;

  return (
    <aside className="sidebar">
      <div className="nav">
        {items.map(({ id, label }) => (
          <button
            key={id}
            className={`navItem ${active === id ? "navItemActive" : ""}`}
            onClick={() => onSelect(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="sidebarFooter">
        {user?.email && <div className="sidebarEmail">{user.email}</div>}
        <button className="sidebarLogout" onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}