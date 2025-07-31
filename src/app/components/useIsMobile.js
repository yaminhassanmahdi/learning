import { useState, useEffect } from "react";

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Function to check screen size
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkScreenSize(); // Run on mount

    window.addEventListener("resize", checkScreenSize); // Listen for resize
    return () => window.removeEventListener("resize", checkScreenSize); // Cleanup
  }, [breakpoint]);

  return isMobile;
};

export default useIsMobile;
