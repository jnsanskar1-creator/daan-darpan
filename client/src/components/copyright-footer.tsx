import mandirLogo from "@assets/new logo mandir color_1754807711657.jpg";

export default function CopyrightFooter() {
  return (
    <footer className="bg-white border-t p-3 mt-8">
      <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
        <img 
          src={mandirLogo} 
          alt="श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति शिवनगर" 
          className="w-4 h-4 rounded-full"
        />
        <span className="text-center">
          © श्री पार्श्वनाथ दिगम्बर जैन मंदिर समिति शिवनगर, जबलपुर
        </span>
      </div>
    </footer>
  );
}