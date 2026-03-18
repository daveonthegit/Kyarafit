"use client";

import { motion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import React from "react";
import { Autoplay, EffectCards, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/effect-cards";
import "swiper/css/pagination";
import "swiper/css/navigation";

import { cn } from "@/lib/utils";

export interface SwipeCardImageItem {
  src: string;
  alt: string;
}

export interface SwipeCardProps<T = React.ReactNode> {
  /** Slide content: array of ReactNode, or array of items with optional renderSlide */
  children?: React.ReactNode;
  /** When using items, pass an array. Image items { src, alt } render as images; pass renderSlide for custom items. */
  items?: SwipeCardImageItem[] | T[];
  renderSlide?: (item: T, index: number) => React.ReactNode;
  className?: string;
  slideClassName?: string;
  showPagination?: boolean;
  showNavigation?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  spaceBetween?: number;
  /** Carousel height (default 380px); width is controlled by max-width in className */
  height?: number | string;
  /** Entrance animation */
  animate?: boolean;
  /** Stable key per item for loop mode (e.g. build._id). Helps prevent wonky loop behavior. */
  keyExtractor?: (item: T, index: number) => string | number;
}

const defaultSlideRenderer = (item: SwipeCardImageItem) => (
  <img className="h-full w-full object-cover" src={item.src} alt={item.alt} />
);

function SwipeCardInner<T>({
  children,
  items,
  renderSlide,
  className,
  slideClassName,
  showPagination = false,
  showNavigation = false,
  loop = true,
  autoplay = false,
  spaceBetween = 40,
  height = 380,
  animate = true,
  keyExtractor,
}: SwipeCardProps<T>) {
  const getKey = (item: T | SwipeCardImageItem, index: number): string | number =>
    keyExtractor ? keyExtractor(item as T, index) : index;

  const isImageItems =
    items &&
    items.length > 0 &&
    typeof (items[0] as SwipeCardImageItem).src === "string" &&
    typeof (items[0] as SwipeCardImageItem).alt === "string";
  const slidesFromItems = items
    ? isImageItems
      ? (items as SwipeCardImageItem[]).map((item, index) => (
          <SwiperSlide
            key={getKey(item as T, index)}
            className={cn("rounded-2xl", slideClassName)}
          >
            {(renderSlide as (item: SwipeCardImageItem, index: number) => React.ReactNode)?.(
              item as SwipeCardImageItem,
              index
            ) ?? defaultSlideRenderer(item as SwipeCardImageItem)}
          </SwiperSlide>
        ))
      : renderSlide
        ? items.map((item, index) => (
            <SwiperSlide
              key={getKey(item, index)}
              className={cn("rounded-2xl", slideClassName)}
            >
              {renderSlide(item as T, index)}
            </SwiperSlide>
          ))
        : null
    : null;

  const slides =
    slidesFromItems ??
    React.Children.map(children, (child, index) => (
      <SwiperSlide key={index} className={cn("rounded-2xl", slideClassName)}>
        {child}
      </SwiperSlide>
    ));

  if (!slides?.length) return null;

  const css = `
  .SwipeCard-swiper {
    padding-bottom: 50px !important;
  }
  .SwipeCard-swiper .swiper-slide {
    border-radius: 1rem;
    overflow: hidden;
    background: var(--kyar-bg-warm, #FAF9F7);
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 20px 40px rgba(0,0,0,0.05);
  }
  `;

  const content = (
    <>
      <style>{css}</style>
      <Swiper
        spaceBetween={spaceBetween}
        autoplay={
          autoplay
            ? {
                delay: 3000,
                disableOnInteraction: false,
              }
            : false
        }
        effect="cards"
        grabCursor
        loop={loop && slides.length >= 2}
        loopAdditionalSlides={loop && slides.length >= 2 ? 2 : 0}
        pagination={
          showPagination
            ? {
                clickable: true,
              }
            : false
        }
        navigation={
          showNavigation
            ? {
                nextEl: ".swiper-button-next",
                prevEl: ".swiper-button-prev",
              }
            : false
        }
        className={cn("SwipeCard-swiper w-[260px] sm:w-[280px]", className)}
        style={{ height: typeof height === "number" ? `${height}px` : height }}
        modules={[EffectCards, Autoplay, Pagination, Navigation]}
      >
        {slides}
        {showNavigation && (
          <>
            <div className="swiper-button-next after:hidden text-kyar-text hover:text-kyar-accent transition-colors">
              <ChevronRightIcon className="h-6 w-6" />
            </div>
            <div className="swiper-button-prev after:hidden text-kyar-text hover:text-kyar-accent transition-colors">
              <ChevronLeftIcon className="h-6 w-6" />
            </div>
          </>
        )}
      </Swiper>
    </>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="relative flex w-full justify-center"
      >
        {content}
      </motion.div>
    );
  }

  return <div className="relative flex w-full justify-center">{content}</div>;
}

export const SwipeCard = React.memo(SwipeCardInner) as typeof SwipeCardInner;
