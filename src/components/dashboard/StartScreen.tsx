import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./BrandMark";
import { BRAND } from "@/config/branding";

interface StartScreenProps {
  onEnter: () => void;
}

export function StartScreen({ onEnter }: StartScreenProps) {
  const handleEnter = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore
    }
    try {
      // iOS / mobile autoplay unlock — play a 1-sample silent buffer on the
      // user gesture so audio can play later without user interaction.
      // Verbatim del repo original — no cerrar el context.
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // ignore
    }
    onEnter();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="relative flex h-full w-full flex-col items-center justify-center px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mb-4 font-sans text-xs uppercase tracking-[0.55em] text-vault-blue/70"
      >
        {BRAND.hallmark}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <BrandMark size={210} showWordmark />
        </motion.div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.25, ease: "easeOut" }}
        className="mt-6 text-center font-display text-3xl uppercase tracking-[0.2em] text-cyan-glow sm:text-4xl"
      >
        Trading Vault
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26, duration: 0.25, ease: "easeOut" }}
        className="mt-3 max-w-2xl text-center font-sans text-sm tracking-[0.35em] text-vault-silver/60 sm:text-base"
      >
        {BRAND.tagline.toUpperCase()}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.25, ease: "easeOut" }}
        className="mt-12"
      >
        <Button
          size="xl"
          onClick={handleEnter}
          className="font-display text-2xl tracking-[0.2em]"
        >
          Enter Vault
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="absolute bottom-10 font-sans text-xs tracking-[0.5em] text-vault-blue/50"
      >
        OPERATIONS CONSOLE
      </motion.p>
    </motion.div>
  );
}
