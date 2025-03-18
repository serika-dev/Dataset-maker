import './globals.css';

export const metadata = {
  title: 'Rayen AI Training Data Collection',
  description: 'A modern tool for collecting and managing AI training data for fine-tuning language models',
  keywords: 'AI, machine learning, training data, language models, fine-tuning',
  authors: [{ name: 'Rayen AI' }],
};

export const viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
