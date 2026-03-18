"use client";

import React, { useRef } from "react";
import { useScroll, useTransform, motion, type MotionValue } from "framer-motion";

type ContainerScrollVariant = "default" | "compact";

export const ContainerScroll = ({
  titleComponent,
  children,
  variant = "default",
  className,
  cardClassName,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
  variant?: ContainerScrollVariant;
  className?: string;
  cardClassName?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.7, 0.9] : [1.05, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const heightClass = variant === "compact" ? "h-[38rem] md:h-[48rem]" : "h-[60rem] md:h-[80rem]";
  const innerPy = variant === "compact" ? "py-6 md:py-16" : "py-10 md:py-40";

  return (
    <div
      className={`${heightClass} flex items-center justify-center relative p-2 md:p-6 ${className ?? ""}`}
      ref={containerRef}
    >
      <div
        className={`${innerPy} w-full relative`}
        style={{
          perspective: "1000px",
        }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale} className={cardClassName}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>;
  titleComponent: string | React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="div max-w-5xl mx-auto text-center"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
  className,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className={`max-w-5xl -mt-12 mx-auto h-[24rem] md:h-[32rem] w-full border-4 border-kyar-border p-2 md:p-6 bg-kyar-surface rounded-2xl shadow-soft ${className ?? ""}`}
    >
      <div className="h-full w-full overflow-hidden rounded-xl bg-kyar-muted md:rounded-xl md:p-4">
        {children}
      </div>
    </motion.div>
  );
};
