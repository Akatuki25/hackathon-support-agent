import { DarkModeType } from "@/types/componetsTypes";
import { useDarkMode } from "@/hooks/useDarkMode";

const LightGridEdges: React.FC<DarkModeType> = () => {
    const { darkMode } = useDarkMode();
    
    return (
        <>
              {/* Animated background grid */}
              <div className={`absolute inset-0 overflow-hidden pointer-events-none ${darkMode ? 'opacity-20' : 'opacity-10'}`}>
                <div className="absolute inset-0" style={{ 
                  backgroundImage: `linear-gradient(${darkMode ? '#00ffe1' : '#8a2be2'} 1px, transparent 1px), 
                                    linear-gradient(90deg, ${darkMode ? '#00ffe1' : '#8a2be2'} 1px, transparent 1px)`,
                  backgroundSize: '40px 40px',
                  backgroundPosition: '-1px -1px'
                }}></div>
              </div>
              
              {/* Glowing edges */}
              <div className="fixed bottom-0 left-0 right-0 h-1 z-20">
                <div className={`h-full ${darkMode ? 'bg-cyan-500' : 'bg-purple-500'} animate-pulse`}></div>
              </div>
              <div className="fixed top-0 bottom-0 right-0 w-1 z-20">
                <div className={`w-full ${darkMode ? 'bg-pink-500' : 'bg-blue-500'} animate-pulse`}></div>
              </div>
        
    </>
    );
    }