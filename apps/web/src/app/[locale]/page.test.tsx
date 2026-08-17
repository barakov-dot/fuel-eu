import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import LocaleHomePage from '@/app/[locale]/page';

jest.mock('@/components/home/HomeExplorer', () => ({
  HomeExplorer: () => <div data-testid="home-explorer">Home Explorer</div>,
}));

describe('Locale home page smoke', () => {
  it('renders the home explorer shell', () => {
    render(<LocaleHomePage />);
    expect(screen.getByTestId('home-explorer')).toBeInTheDocument();
  });
});
