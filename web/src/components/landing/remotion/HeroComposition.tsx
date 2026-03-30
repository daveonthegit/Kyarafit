import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Img, staticFile } from "remotion";

const Scene1Closet = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 15, 85, 100], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cols = 3;
  const itemWidth = 240;
  const itemHeight = 320;
  const gap = 40;

  const mockItems = [
    { name: "Leather Jacket", type: "Outerwear", cost: "$120.00", img: "Leather_Jacket.png" },
    { name: "Blonde Wig", type: "Wig", cost: "$45.00", img: "blonde_wig.jpg" },
    { name: "Red Scarf", type: "Accessory", cost: "$25.00", img: "red_scarf.png" },
    { name: "Utility Belt", type: "Accessory", cost: "$35.00", img: "Utility-belt.jpg" },
    { name: "Prop Sword", type: "Prop", cost: "$85.00", img: "urahara-sword.jpg" },
    { name: "Styled Wig", type: "Wig", cost: "$60.00", img: "wig2.jpg" },
  ];

  return (
    <AbsoluteFill className="bg-transparent flex flex-col items-center justify-center font-sans" style={{ opacity: sceneOpacity }}>
      <h2 
        className="text-white font-sans tracking-tight font-medium text-[5rem] absolute top-32"
        style={{ 
          opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [10, 25], [20, 0], { extrapolateRight: "clamp" })}px)`
        }}
      >
        Your Digital Closet
      </h2>
      
      <div 
        className="relative"
        style={{ width: cols * itemWidth + (cols - 1) * gap, height: 2 * itemHeight + gap, marginTop: 150 }}
      >
        {mockItems.map((item, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          
          const targetX = col * (itemWidth + gap);
          const targetY = row * (itemHeight + gap);
          
          const randomFactor = (i * 13) % 10; 
          const startX = targetX + (randomFactor - 5) * 150;
          const startY = targetY + (randomFactor - 5) * 150;
          const startRot = (randomFactor - 5) * 20;
          
          const progress = spring({
            frame: frame - i * 4 - 10,
            fps,
            config: { damping: 14, stiffness: 80 }
          });
          
          const x = interpolate(progress, [0, 1], [startX, targetX]);
          const y = interpolate(progress, [0, 1], [startY, targetY]);
          const rot = interpolate(progress, [0, 1], [startRot, 0]);
          const opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div
              key={i}
              className="absolute bg-[#0A0A0A] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
              style={{
                width: itemWidth,
                height: itemHeight,
                transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
                opacity,
                boxShadow: "0 0 40px rgba(0,0,0,0.5)"
              }}
            >
              <div className="flex-1 bg-white/5 overflow-hidden">
                <Img src={staticFile(`mock/${item.img}`)} className="w-full h-full object-cover" />
              </div>
              <div className="p-4 bg-[#0A0A0A] border-t border-white/10 flex flex-col gap-1.5 h-[80px]">
                <p className="text-white text-lg font-medium truncate">{item.name}</p>
                <div className="flex items-center justify-between text-white/50 text-sm">
                  <span>{item.type}</span>
                  <span>{item.cost}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Scene2Build = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 15, 85, 100], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const progressWidth = spring({
    frame: frame - 20,
    fps,
    config: { damping: 20, stiffness: 60 },
    durationInFrames: 60
  });

  return (
    <AbsoluteFill className="bg-transparent flex flex-col items-center justify-center font-sans" style={{ opacity: sceneOpacity }}>
      <h2 
        className="text-[#1152D4] uppercase tracking-[0.25em] font-semibold text-3xl absolute top-32"
        style={{ 
          opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [5, 20], [20, 0], { extrapolateRight: "clamp" })}px)`
        }}
      >
        Track Every Build
      </h2>

      <div 
        className="w-[800px] bg-[#0A0A0A] border border-white/10 p-12 rounded-3xl"
        style={{
          boxShadow: "0 0 80px rgba(17, 82, 212, 0.15)",
          transform: `scale(${interpolate(frame, [10, 30], [0.95, 1], { extrapolateRight: "clamp" })})`
        }}
      >
        <div className="flex flex-col sm:flex-row gap-10 mb-12 items-center sm:items-start">
          <div className="relative w-40 h-40 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
              <circle 
                cx="18" cy="18" r="15.9155" fill="none" stroke="#1152D4" 
                strokeWidth="2.5" strokeLinecap="round" 
                strokeDasharray={`${progressWidth * 100} 100`} 
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-sans tracking-tight text-4xl font-semibold text-white leading-none tabular-nums">
                {Math.round(progressWidth * 100)}%
              </span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-3 pt-4">
             <div className="font-sans-wide text-xs uppercase tracking-[0.2em] font-semibold text-white/40">Status</div>
             <div className="font-sans tracking-tight font-medium text-4xl text-white">In Progress</div>
             <div className="text-xl text-white/60 mt-2">
               {Math.floor(progressWidth * 18)} of 18 tasks complete
             </div>
          </div>
        </div>
        
        <div className="space-y-6 border-t border-white/10 pt-8">
          {[
            "Prime and sand shoulder pieces",
            "Paint base coat",
            "Add weathering details"
          ].map((itemLabel, i) => {
            const checkThreshold = 0.3 * (i + 1);
            const isChecked = progressWidth >= checkThreshold;
            const itemOp = spring({ frame: frame - 25 - i * 8, fps, config: { damping: 15 } });
            
            return (
              <div key={i} className="flex items-center gap-5" style={{ opacity: itemOp }}>
                <div 
                  className="w-8 h-8 rounded-md border-2 flex items-center justify-center transition-colors duration-200"
                  style={{ 
                    borderColor: isChecked ? '#1152D4' : 'rgba(255,255,255,0.1)',
                    backgroundColor: isChecked ? '#1152D4' : 'transparent'
                  }}
                >
                  <svg 
                    className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"
                    style={{ 
                      opacity: interpolate(progressWidth, [checkThreshold - 0.1, checkThreshold], [0, 1], { extrapolateRight: "clamp" }),
                      transform: `scale(${interpolate(progressWidth, [checkThreshold - 0.1, checkThreshold], [0.5, 1], { extrapolateRight: "clamp" })})`
                    }} 
                  >
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className={`text-xl font-sans font-medium transition-all ${isChecked ? "opacity-40 line-through text-white/60" : "text-white"}`}>
                    {itemLabel}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scene3Events = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 15, 105, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slideUp = spring({
    frame: frame - 10,
    fps,
    config: { damping: 16, stiffness: 90 }
  });

  const yOffset = interpolate(slideUp, [0, 1], [600, 0]);

  return (
    <AbsoluteFill className="bg-transparent flex flex-col items-center justify-center font-sans overflow-hidden" style={{ opacity: sceneOpacity }}>
      <h2 
        className="text-white font-sans tracking-tight font-medium text-[5rem] absolute top-24"
        style={{ opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }) }}
      >
        Conventions Sorted
      </h2>
      
      {/* Mobile Mockup */}
      <div 
        className="w-[440px] h-[880px] bg-[#050505] border-[16px] border-[#111] rounded-[3.5rem] overflow-hidden absolute top-[220px] flex flex-col"
        style={{ 
          boxShadow: "0 0 100px rgba(0,0,0,1)",
          transform: `translateY(${yOffset}px)` 
        }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-[#111] rounded-b-3xl z-20" />
        
        <div className="h-48 bg-[#1152D4] p-10 text-white flex flex-col justify-end relative overflow-hidden">
          <Img src={staticFile("mock/Anime-NYC.png")} className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" />
          <div className="relative z-10">
            <div className="font-bold tracking-widest uppercase text-sm mb-2 opacity-80">Anime NY 2026</div>
            <div className="text-4xl font-serif">Packing List</div>
          </div>
        </div>
        
        <div className="p-8 flex-1 space-y-5 bg-[#050505] border-x border-white/5">
          {[
            "Armor Chestplate",
            "Undergarments (Black)",
            "Boots",
            "Repair Kit",
            "Props"
          ].map((itemLabel, i) => {
             const checkOp = spring({ frame: frame - 40 - i * 10, fps, config: { damping: 12, stiffness: 100 } });
             return (
               <div key={i} className="flex gap-5 items-center bg-[#0A0A0A] p-5 rounded-2xl border border-white/10">
                 <div 
                    className="w-8 h-8 rounded-md border-2 flex items-center justify-center transition-colors" 
                    style={{ 
                      borderColor: checkOp > 0.5 ? '#1152D4' : 'rgba(255,255,255,0.1)',
                      backgroundColor: checkOp > 0.5 ? '#1152D4' : 'transparent' 
                    }}
                  >
                    <svg 
                      className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"
                      style={{ 
                        opacity: checkOp,
                        transform: `scale(${checkOp})`
                      }}
                    >
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                 </div>
                 <div className="flex-1">
                   <div className={`text-lg font-sans font-medium transition-all ${checkOp > 0.5 ? "opacity-40 line-through text-white/60" : "text-white"}`}>
                     {itemLabel}
                   </div>
                 </div>
               </div>
             )
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const HeroComposition = () => {
  return (
                <AbsoluteFill className="bg-[#050505]">
      <Sequence from={0} durationInFrames={100}>
        <Scene1Closet />
      </Sequence>
      <Sequence from={90} durationInFrames={100}>
        <Scene2Build />
      </Sequence>
      <Sequence from={180} durationInFrames={120}>
        <Scene3Events />
      </Sequence>
    </AbsoluteFill>
  );
};
