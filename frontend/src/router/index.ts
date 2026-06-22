import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import CoworkView from '../components/CoworkView.vue'
import ScheduleTasksView from '../components/ScheduleTasksView.vue'
import NotesView from '../components/NotesView.vue'
import ConnectorsView from '../components/ConnectorsView.vue'
import OAuthCallbackPage from '../components/OAuthCallbackPage.vue'
import AgentOutputView from '../components/AgentOutputView.vue'
import SettingsView from '../components/SettingsView.vue'
import ProvidersView from '../components/ProvidersView.vue'
import AgentsView from '../components/AgentsView.vue'
import ToolsView from '../components/ToolsView.vue'
import MemoryView from '../components/MemoryView.vue'
import SkillsView from '../components/SkillsView.vue'

import ScheduleTaskDetailView from '../components/ScheduleTaskDetailView.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/cowork' },
  { path: '/cowork', name: 'cowork', component: CoworkView },
  { path: '/tasks', name: 'tasks', component: ScheduleTasksView },
  { path: '/tasks/:id', name: 'task-detail', component: ScheduleTaskDetailView, props: true },
  { path: '/notes', name: 'notes', component: NotesView },
  { path: '/connectors', name: 'connectors', component: ConnectorsView },
  { path: '/agent-output', name: 'agent-output', component: AgentOutputView },
  { path: '/oauth/callback', name: 'oauth-callback', component: OAuthCallbackPage },
  { path: '/providers', name: 'providers', component: ProvidersView },
  { path: '/agents', name: 'agents', component: AgentsView },
  { path: '/tools', name: 'tools', component: ToolsView },
  { path: '/memories', name: 'memories', component: MemoryView },
  { path: '/skills', name: 'skills', component: SkillsView },
  { path: '/settings', redirect: '/settings/general' },
  { path: '/settings/:tab', name: 'settings', component: SettingsView, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/cowork' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
