export const HERO_ANSWERS: Record<string, string> = {
    "what is memoraiz and how can it help my company?":
        "MemorAIz is an AI-powered ecosystem designed to help organizations (like schools, museums, publishers, and social entities) transform their static knowledge into interactive digital experiences. \n\nIt can help your company by:\n1. **Centralizing Knowledge**: Turning documents and archives into searchable, intelligent assistants.\n2. **Automating Content**: Creating summaries, maps, quizzes, and podcasts from existing materials.\n3. **Improving Access**: Making information more accessible through simplification, translation, and inclusive design.\n4. **Boosting Productivity**: Assisting teams in drafting projects, editorial work, and social communication.",

    "what details do i need to provide for the company canvas?":
        "The **Company Canvas** is the core identity profile for your AI assistant. To complete it, you'll need to provide:\n\n1. **Company Name**: Your official organization title.\n2. **Industry**: The sector you serve (e.g., Education, Tourism, Publishing).\n3. **Description**: A brief summary of your mission and activities.\n4. **AI Maturity Level**: Your current familiarity with AI (Explorer, Adopter, Strategist, or Innovator).\n5. **AI Usage**: How you currently use AI or where you want to start.\n6. **Goals**: What you specifically want to achieve with MemorAIz.",

    "how do i define my company's ai maturity level?":
        "Memoraiz uses four levels to calibrate your onboarding:\n\n- **Explorer (Esploratore)**: Just starting. Casual use of tools like ChatGPT; no unified strategy.\n- **Adopter (Praticante)**: Regular use for specific tasks (emails, summaries) but lacks deep integration.\n- **Strategist (Stratega)**: AI is integrated into core processes with a clear data and automation strategy.\n- **Innovator (Visionario)**: Pushing boundaries with custom models and complex automated ecosystems.\n\nChoose the level that best describes your team's current daily workflow.",

    "what are some common onboarding goals i should consider?":
        "Common goals with Memoraiz include:\n\n- **Automated Customer/User Support**: Providing 24/7 intelligent answers to families, students, or readers.\n- **Knowledge Centralization**: Making internal archives and catalogs easily explorable.\n- **Streamlined Content Repurposing**: Converting articles or documents into multiple formats (audio, visual, social).\n- **Inclusive Communication**: Ensuring accessibility for people with disabilities or linguistic barriers.\n- **Strategic Project Support**: Assisting in the creation of funding bids and social projects.",
};

export function getHeroAnswer(query: string): string | null {
    const normalized = query.toLowerCase().trim();
    // Check exact key match
    if (HERO_ANSWERS[normalized]) {
        return HERO_ANSWERS[normalized];
    }

    // Basic substring/keyword match for common variations if needed
    // For now, focusing on the Prompts which are exact clicks
    return null;
}
