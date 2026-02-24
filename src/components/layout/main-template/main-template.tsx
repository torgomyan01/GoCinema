import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';

interface MainTemplateProps {
  children: React.ReactNode;
  phoneNumber?: string;
}

async function MainTemplate({ children, phoneNumber }: MainTemplateProps) {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        {children}
      </main>
      <Footer />
    </>
  );
}

export default MainTemplate;
