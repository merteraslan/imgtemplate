"use client";

import { useState, useEffect } from 'react';
import { getApiKey, setApiKey } from '@/utils/apiUtils';

export default function ApiKeyInput() {
    const [apiKey, setApiKeyState] = useState('');
    const [isSaved, setIsSaved] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Load saved API key on mount
        const savedKey = getApiKey();
        if (savedKey) {
            setApiKeyState(savedKey);
            setIsSaved(true);
        }
    }, []);

    const handleSave = () => {
        setApiKey(apiKey);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-full shadow"
            >
                {isVisible ? 'Hide API Settings' : 'API Settings'}
            </button>

            {isVisible && (
                <div className="mt-2 p-4 bg-white rounded shadow-lg border w-72">
                    <h3 className="text-lg font-semibold mb-2">API Authentication</h3>
                    <p className="text-sm text-gray-600 mb-2">
                        Enter your API key to authenticate requests
                    </p>

                    <div className="flex relative">
                        <input
                            type={isVisible ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKeyState(e.target.value)}
                            placeholder="Enter your API key"
                            className="border rounded p-2 w-full pr-10"
                        />
                    </div>

                    <div className="mt-2 flex justify-between items-center">
                        <button
                            onClick={handleSave}
                            disabled={!apiKey}
                            className={`py-1 px-3 rounded text-white ${apiKey ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
                                }`}
                        >
                            Save Key
                        </button>
                        {isSaved && (
                            <span className="text-green-600 text-sm">✓ Saved</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
} 