"use client";

import React from "react";
import Link from "next/link";

interface User {
  id: string;
  username?: string;
  full_name?: string;
}

interface ReactionTooltipProps {
  users: User[];
  isVisible: boolean;
}

const ReactionTooltip: React.FC<ReactionTooltipProps> = ({ users, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="absolute z-50 top-full  left-full -translate-x-1/3 
                    bg-black text-white text-xs rounded-md shadow-lg px-2 py-1
                    w-max max-h-48 overflow-y-auto">
      <ul className="space-y-1">
        {users.map((user) => (
          <li key={user.id}>
            {user.username ? (
              <Link
                href={`/user/${user.username}`}
                className="hover:underline cursor-pointer block"
              >
                {user.full_name || user.username}
              </Link>
            ) : (
              <span className="block">
                {user.full_name || "Unknown user"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ReactionTooltip;
