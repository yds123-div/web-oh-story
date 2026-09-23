import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SideNav } from './SideNav';

function renderNav() {
  return render(
    <MemoryRouter>
      <SideNav />
    </MemoryRouter>,
  );
}

describe('SideNav「创作」入口', () => {
  beforeEach(() => localStorage.clear());

  it('没有最近项目时指向空白创作页', () => {
    renderNav();
    expect(screen.getByText('创作').closest('a')).toHaveAttribute('href', '/create');
  });

  it('有最近项目时直达该项目剧本列表', () => {
    localStorage.setItem('deepsfv-recent-project', '1790145377136');
    renderNav();
    expect(screen.getByText('创作').closest('a')).toHaveAttribute(
      'href',
      '/project/1790145377136/scripts',
    );
  });
});
