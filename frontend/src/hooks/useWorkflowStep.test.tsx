import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { WorkflowStepProvider } from './useWorkflowStep';
import { handlers } from '../mocks/handlers';
import { resetBackendDb, DEMO_PROJECT_ID } from '../mocks/backendDb';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  resetBackendDb();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

describe('WorkflowStepProvider 最近项目记录', () => {
  it('挂载在 /project/:id/* 路由下时记录该项目为最近项目', async () => {
    render(
      <MemoryRouter initialEntries={[`/project/${DEMO_PROJECT_ID}/scripts`]}>
        <Routes>
          <Route
            path="/project/:id/scripts"
            element={
              <WorkflowStepProvider>
                <div>provider-child</div>
              </WorkflowStepProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('provider-child')).toBeInTheDocument();
    expect(localStorage.getItem('deepsfv-recent-project')).toBe(String(DEMO_PROJECT_ID));
  });
});
