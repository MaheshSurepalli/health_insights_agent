import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

export default function Header() {
  const { user, logout } = useAuth0();

  return (
    <div className="flex justify-between items-center border-b px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-xl">
      <h1 className="text-lg font-semibold">Hi, {user?.name}</h1>
      <button
        onClick={() => logout({ returnTo: window.location.origin })}
        className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg text-sm"
      >
        Logout
      </button>
    </div>
  );
}
