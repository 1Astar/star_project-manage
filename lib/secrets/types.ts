export interface ProjectSecret {
  id: string;
  projectId: string;
  name: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSecretRow {
  id: string;
  project_id: string;
  name: string;
  encrypted_value: string;
  created_at: string;
  updated_at: string;
}
