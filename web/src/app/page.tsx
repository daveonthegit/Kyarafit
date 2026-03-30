"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, useSpring, useMotionValueEvent } from "framer-motion";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { HeroVideoPlayer } from "@/components/landing/remotion/HeroVideoPlayer";
import { useRef, useState } from "react";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  
  // Hero Parallax & Fade
  const yHeroVideo = useTransform(heroScroll, [0, 1], ["0%", "15%"]);
  const scaleHeroVideo = useTransform(heroScroll, [0, 1], [1, 0.95]);
  const opacityHeroVideo = useTransform(heroScroll, [0, 0.8], [1, 0]);

  // Features Sticky Scroll Logic
  const featuresRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: featuresScroll } = useScroll({
    target: featuresRef,
    offset: ["start start", "end end"],
  });

  const [activeFeature, setActiveFeature] = useState(0);

  useMotionValueEvent(featuresScroll, "change", (latest) => {
    if (latest < 0.33) setActiveFeature(0);
    else if (latest < 0.66) setActiveFeature(1);
    else setActiveFeature(2);
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-[#FAFAFA] font-sans overflow-x-hidden selection:bg-kyar-accent selection:text-white">
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 flex justify-between items-center py-6 z-50 mix-blend-difference text-white ${SECTION_PADDING} ${MAX_WIDTH}`}
      >
        <Link
          href="/"
          className="font-serif-elegant text-xl sm:text-2xl font-bold italic tracking-tighter"
        >
          Kyarafit
        </Link>
        <LandingAuthCta variant="header" />
      </header>

      <main className="flex-1 flex flex-col relative z-10" role="main">
        {/* HERO SECTION */}
        <section
          ref={heroRef}
          className="relative pt-40 lg:pt-52 pb-20 lg:pb-32 min-h-[100vh] flex flex-col items-center overflow-hidden"
        >
          {/* Subtle glowing background effect */}
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-kyar-accent/20 blur-[120px] rounded-full pointer-events-none opacity-50 mix-blend-screen" />

          <motion.div 
            className={`text-center z-10 relative ${SECTION_PADDING} ${MAX_WIDTH} flex flex-col items-center`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium tracking-wide uppercase text-white/80 mb-8 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-kyar-accent animate-pulse" />
              The Cosplay System
            </div>
            
            <h1 className="font-sans text-5xl sm:text-7xl lg:text-[6.5rem] tracking-tighter leading-[1.05] font-medium mb-8 max-w-5xl mx-auto">
              Master the craft.<br className="hidden sm:block" /> Organize the chaos.
            </h1>
            
            <p className="text-lg lg:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              Purpose-built for planning, building, and packing for conventions. Designed for meticulous creators who want to drop the spreadsheets.
            </p>

            <LandingAuthCta variant="hero" />
          </motion.div>

          {/* Hero Video */}
          <motion.div 
            style={{ y: yHeroVideo, scale: scaleHeroVideo, opacity: opacityHeroVideo }}
            className="w-full max-w-[1200px] mx-auto px-6 relative z-0 mt-20"
          >
            <div className="relative aspect-video bg-[#0A0A0A] rounded-2xl sm:rounded-[2rem] border border-white/10 shadow-[0_0_100px_rgba(17,82,212,0.15)] overflow-hidden flex items-center justify-center">
               <HeroVideoPlayer />
            </div>
          </motion.div>
        </section>

        {/* STICKY SCROLL FEATURES */}
        <section ref={featuresRef} className="relative h-[300vh] bg-[#000000]">
          {/* Sticky container that stays in view */}
          <div className="sticky top-0 h-screen flex items-center overflow-hidden">
             
             {/* Background glow that follows active feature */}
             <div 
               className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-5xl blur-[150px] opacity-20 pointer-events-none transition-colors duration-1000"
               style={{ backgroundColor: activeFeature === 0 ? '#1152D4' : activeFeature === 1 ? '#4F46E5' : '#7C3AED' }}
             />

             <div className={`${SECTION_PADDING} ${MAX_WIDTH} flex flex-col lg:flex-row items-center gap-16 relative z-10`}>
                
                {/* Left Text Column */}
                <div className="lg:w-5/12 flex flex-col gap-16 lg:gap-32">
                  
                  {/* Feature 1 */}
                  <div className={`transition-all duration-700 ${activeFeature === 0 ? 'opacity-100 transform-none' : 'opacity-20 translate-y-8 blur-[2px]'}`}>
                    <h3 className="text-sm font-semibold tracking-widest uppercase text-kyar-accent mb-4">01 — Digital Closet</h3>
                    <h2 className="text-4xl lg:text-5xl font-medium tracking-tight mb-4 text-white">Your entire wardrobe, visually cataloged.</h2>
                    <p className="text-lg text-white/50 leading-relaxed">
                      Keep track of every wig, prop, and armor piece in a highly visual database. Know exactly what you own and what it costs.
                    </p>
                  </div>

                  {/* Feature 2 */}
                  <div className={`transition-all duration-700 ${activeFeature === 1 ? 'opacity-100 transform-none' : activeFeature < 1 ? 'opacity-20 translate-y-8 blur-[2px]' : 'opacity-20 -translate-y-8 blur-[2px]'}`}>
                    <h3 className="text-sm font-semibold tracking-widest uppercase text-indigo-500 mb-4">02 — Build Tracking</h3>
                    <h2 className="text-4xl lg:text-5xl font-medium tracking-tight mb-4 text-white">From raw materials to finished armor.</h2>
                    <p className="text-lg text-white/50 leading-relaxed">
                      Break down massive cosplays into actionable tasks. Track progress dynamically as you prime, paint, and assemble.
                    </p>
                  </div>

                  {/* Feature 3 */}
                  <div className={`transition-all duration-700 ${activeFeature === 2 ? 'opacity-100 transform-none' : 'opacity-20 -translate-y-8 blur-[2px]'}`}>
                    <h3 className="text-sm font-semibold tracking-widest uppercase text-purple-500 mb-4">03 — Conventions</h3>
                    <h2 className="text-4xl lg:text-5xl font-medium tracking-tight mb-4 text-white">Lineups and packing lists, automated.</h2>
                    <p className="text-lg text-white/50 leading-relaxed">
                      Assign characters to specific days and let Kyarafit generate a foolproof packing list so you never forget a left boot again.
                    </p>
                  </div>

                </div>

                {/* Right Visuals Column */}
                <div className="lg:w-7/12 relative h-[500px] w-full flex items-center justify-center perspective-[1000px]">
                  
                  {/* Visual 1: Closet Grid */}
                  <div 
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ease-out origin-bottom ${activeFeature === 0 ? 'opacity-100 scale-100 rotate-x-0' : activeFeature > 0 ? 'opacity-0 scale-95 rotate-x-[15deg] translate-y-[-10%]' : 'opacity-0 scale-105 translate-y-[10%]'}`}
                  >
                    <div className="w-[120%] lg:w-full grid grid-cols-3 gap-4 p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-2xl shadow-2xl">
                      {[
                        { img: "/mock/Leather_Jacket.png", name: "Jacket" },
                        { img: "/mock/blonde_wig.jpg", name: "Blonde Wig" },
                        { img: "/mock/red_scarf.png", name: "Silk Scarf" },
                        { img: "/mock/Utility-belt.jpg", name: "Utility Belt" },
                        { img: "/mock/urahara-sword.jpg", name: "Prop Sword" },
                        { img: "/mock/wig2.jpg", name: "Styled Wig" },
                      ].map((item, i) => (
                        <div key={i} className="flex flex-col bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden shadow-lg">
                           <div className="aspect-square bg-white/5 relative overflow-hidden">
                              <img src={item.img} alt={item.name} className="w-full h-full object-cover opacity-90" />
                           </div>
                           <div className="p-3 text-[11px] font-medium text-white/80">{item.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual 2: Build Progress */}
                  <div 
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ease-out origin-bottom ${activeFeature === 1 ? 'opacity-100 scale-100 rotate-x-0' : activeFeature > 1 ? 'opacity-0 scale-95 rotate-x-[15deg] translate-y-[-10%]' : 'opacity-0 scale-105 rotate-x-[-15deg] translate-y-[10%]'}`}
                  >
                    <div className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl p-8 backdrop-blur-xl">
                      <div className="flex gap-6 items-center mb-8">
                        <div className="relative w-24 h-24 shrink-0">
                          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-white/5" strokeWidth="2.5" />
                            <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-indigo-500" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="75 100" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="font-sans tracking-tight text-xl font-medium text-white">75%</span>
                          </div>
                        </div>
                        <div className="flex flex-col">
                           <div className="text-xs uppercase tracking-widest font-semibold text-white/40 mb-1">Status</div>
                           <div className="font-sans tracking-tight text-3xl font-medium text-white">In Progress</div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {["Prime and sand pieces", "Paint base coat", "Add weathering"].map((task, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${i < 2 ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'}`}>
                               {i < 2 && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            </div>
                            <span className={`text-sm font-medium ${i < 2 ? 'text-white/40 line-through' : 'text-white/90'}`}>{task}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Visual 3: Events & Packing */}
                  <div 
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ease-out origin-bottom ${activeFeature === 2 ? 'opacity-100 scale-100 rotate-x-0' : 'opacity-0 scale-105 rotate-x-[-15deg] translate-y-[10%]'}`}
                  >
                    <div className="w-[320px] h-[550px] bg-[#0A0A0A] border-[8px] border-[#1A1A1A] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#1A1A1A] rounded-b-2xl z-20" />
                      
                      <div className="h-40 bg-purple-600 p-6 flex flex-col justify-end text-white relative">
                        <img src="/mock/katsucon.png" alt="Convention Background" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
                        <div className="relative z-10">
                          <div className="font-bold tracking-widest uppercase text-[10px] mb-1 opacity-80">Katsu 2026</div>
                          <div className="text-2xl font-serif-elegant">Packing List</div>
                        </div>
                      </div>
                      
                      <div className="flex-1 p-6 space-y-4 bg-[#0A0A0A]">
                        {["Armor Chestplate", "Undergarments", "Boots", "Repair Kit"].map((task, i) => (
                           <div key={i} className="flex items-center gap-4 pb-3 border-b border-white/5">
                             <div className={`w-4 h-4 rounded border flex items-center justify-center ${i < 2 ? 'bg-purple-500 border-purple-500' : 'border-white/20'}`}>
                               {i < 2 && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                             </div>
                             <span className={`text-xs uppercase tracking-wider font-semibold ${i < 2 ? 'text-white/40 line-through' : 'text-white/90'}`}>{task}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

             </div>
          </div>
        </section>

        {/* WORKFLOW BENTO GRID */}
        <section className={`py-32 bg-[#050505] relative z-10`}>
          <div className={`${SECTION_PADDING} ${MAX_WIDTH}`}>
            <div className="text-center mb-20">
              <h2 className="text-sm uppercase tracking-widest text-kyar-accent font-semibold mb-4">The Workflow</h2>
              <p className="text-4xl sm:text-5xl font-medium tracking-tight">Four steps to absolute clarity.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: "01", title: "Catalog", desc: "Log every wig, prop, and piece into a searchable database." },
                { step: "02", title: "Build", desc: "Link components to characters and track crafting tasks." },
                { step: "03", title: "Plan", desc: "Map outfits to convention days and schedule photoshoots." },
                { step: "04", title: "Pack", desc: "Generate intelligent packing lists so nothing is forgotten." },
              ].map((item, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: idx * 0.1, duration: 0.6 }}
                  key={item.step} 
                  className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors duration-300 relative overflow-hidden group"
                >
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <div className="text-3xl font-serif-elegant text-white/20 mb-6 font-bold italic">{item.step}</div>
                  <h3 className="text-sm uppercase tracking-widest font-semibold mb-3 text-white">{item.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={`py-40 bg-black text-center relative overflow-hidden`}>
          {/* Subtle bottom glow */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-kyar-accent/20 blur-[100px] rounded-full pointer-events-none opacity-50 mix-blend-screen" />
          
          <div className={`relative z-10 ${SECTION_PADDING}`}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl mx-auto border border-white/10 bg-white/5 backdrop-blur-md rounded-3xl p-12 sm:p-20 shadow-2xl"
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight mb-8">
                Elevate your cosplay management.
              </h2>
              <p className="text-lg text-white/50 mb-10 max-w-xl mx-auto leading-relaxed">
                Join the platform designed exclusively for the meticulous nature of costume creation and convention planning.
              </p>
              <LandingAuthCta variant="cta" />
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={`${SECTION_PADDING} py-12 bg-[#050505] border-t border-white/5 ${MAX_WIDTH} relative z-10`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <Link href="/" className="font-serif-elegant text-xl font-bold italic tracking-tighter text-white">
            Kyarafit
          </Link>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-sans font-semibold">
            Cosplay wardrobe & build tracker
          </p>
          <LandingAuthCta variant="footer" />
        </div>
      </footer>
    </div>
  );
}
