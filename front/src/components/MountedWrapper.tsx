"use client";

import { useState, useEffect } from "react";

import Loading from "./PageLoading";

export default function MountedWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // まだマウントしてなかったら何も出さない
    return <Loading />;
  }

  return <>{children}</>;
}
