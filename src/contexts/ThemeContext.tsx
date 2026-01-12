"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type ColorTheme = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'darkblue' | 'ash' | 'teal' | 'cyan' | 'indigo' | 'pink';
type Mode = 'light' | 'dark';

interface ThemeContextType {
    colorTheme: ColorTheme;
    mode: Mode;
    setColorTheme: (theme: ColorTheme) => void;
    setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [colorTheme, setColorThemeState] = useState<ColorTheme>('blue');
    const [mode, setModeState] = useState<Mode>('light');

    useEffect(() => {
        const savedColorTheme = localStorage.getItem('colorTheme') as ColorTheme;
        const savedMode = localStorage.getItem('mode') as Mode;

        if (savedColorTheme) {
            setColorThemeState(savedColorTheme);
        }
        if (savedMode) {
            setModeState(savedMode);
        }

        applyTheme(savedColorTheme || 'blue', savedMode || 'light');
    }, []);

    const setColorTheme = (newTheme: ColorTheme) => {
        setColorThemeState(newTheme);
        localStorage.setItem('colorTheme', newTheme);
        applyTheme(newTheme, mode);
    };

    const setMode = (newMode: Mode) => {
        setModeState(newMode);
        localStorage.setItem('mode', newMode);
        applyTheme(colorTheme, newMode);
    };

    const applyTheme = (theme: ColorTheme, themeMode: Mode) => {
        const root = document.documentElement;

        // Color themes
        const colorThemes = {
            blue: {
                primary: '59 130 246',
                primaryDark: '37 99 235',
            },
            green: {
                primary: '34 197 94',
                primaryDark: '22 163 74',
            },
            purple: {
                primary: '168 85 247',
                primaryDark: '147 51 234',
            },
            orange: {
                primary: '249 115 22',
                primaryDark: '234 88 12',
            },
            red: {
                primary: '239 68 68',
                primaryDark: '220 38 38',
            },
            darkblue: {
                primary: '37 99 235',
                primaryDark: '29 78 216',
            },
            ash: {
                primary: '100 116 139',
                primaryDark: '71 85 105',
            },
            teal: {
                primary: '20 184 166',
                primaryDark: '13 148 136',
            },
            cyan: {
                primary: '6 182 212',
                primaryDark: '8 145 178',
            },
            indigo: {
                primary: '99 102 241',
                primaryDark: '79 70 229',
            },
            pink: {
                primary: '236 72 153',
                primaryDark: '219 39 119',
            }
        };

        // Mode-specific colors
        const modeColors = {
            light: {
                background: '248 250 252',
                foreground: '15 23 42',
                sidebar: '15 23 42',
                card: '255 255 255',
                border: '226 232 240',
            },
            dark: {
                background: '15 23 42',
                foreground: '248 250 252',
                sidebar: '2 6 23',
                card: '30 41 59',
                border: '51 65 85',
            }
        };

        const selectedColorTheme = colorThemes[theme];
        const selectedMode = modeColors[themeMode];

        // Apply colors
        root.style.setProperty('--color-primary', selectedColorTheme.primary);
        root.style.setProperty('--color-primary-dark', selectedColorTheme.primaryDark);
        root.style.setProperty('--color-background', selectedMode.background);
        root.style.setProperty('--color-foreground', selectedMode.foreground);
        root.style.setProperty('--color-sidebar', selectedMode.sidebar);
        root.style.setProperty('--color-card', selectedMode.card);
        root.style.setProperty('--color-border', selectedMode.border);

        // Update body class for dark mode
        if (themeMode === 'dark') {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark-mode');
        } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark-mode');
        }
    };

    return (
        <ThemeContext.Provider value={{ colorTheme, mode, setColorTheme, setMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
