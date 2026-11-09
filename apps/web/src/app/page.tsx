import { Hero } from "@/components/sections/Hero";
import { Features } from "@/components/sections/Features";
import { Apps } from "@/components/sections/Apps";
import { Compatibility } from "@/components/sections/Compatibility";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Demo } from "@/components/sections/Demo";
import { Downloads } from "@/components/sections/Downloads";
import { Faq } from "@/components/sections/Faq";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <Apps />
      <HowItWorks />
      <Demo />
      <Compatibility />
      <Downloads />
      <Faq />
    </>
  );
}
