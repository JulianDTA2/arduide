import { supabase } from "@/integrations/supabase/client";

export interface CloudProject {
  id: string;
  user_id: string;
  name: string;
  blockly_xml: string;
  generated_code: string;
  board: string;
  created_at: string;
  updated_at: string;
}

export interface CloudProjectVersion {
  id: string;
  project_id: string;
  blockly_xml: string;
  generated_code: string;
  created_at: string;
}

const MAX_VERSIONS = 5;

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};

// Get current user ID
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
};

// Project CRUD operations
export const createCloudProject = async (
  name: string,
  blocklyXml: string,
  generatedCode: string,
  board: string
): Promise<CloudProject | null> => {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name,
      blockly_xml: blocklyXml,
      generated_code: generatedCode,
      board,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating cloud project:', error);
    return null;
  }

  // Create initial version
  if (data) {
    await createCloudVersion(data.id, blocklyXml, generatedCode);
  }

  return data;
};

export const getCloudProject = async (id: string): Promise<CloudProject | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching cloud project:', error);
    return null;
  }

  return data;
};

export const getAllCloudProjects = async (): Promise<CloudProject[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching cloud projects:', error);
    return [];
  }

  return data || [];
};

export const updateCloudProject = async (
  id: string,
  updates: Partial<Pick<CloudProject, 'name' | 'blockly_xml' | 'generated_code' | 'board'>>
): Promise<CloudProject | null> => {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating cloud project:', error);
    return null;
  }

  // Create version snapshot if code changed
  if (data && (updates.blockly_xml || updates.generated_code)) {
    await createCloudVersion(
      id,
      updates.blockly_xml || data.blockly_xml,
      updates.generated_code || data.generated_code
    );
  }

  return data;
};

export const deleteCloudProject = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cloud project:', error);
    return false;
  }

  return true;
};

// Version management
export const createCloudVersion = async (
  projectId: string,
  blocklyXml: string,
  generatedCode: string
): Promise<CloudProjectVersion | null> => {
  const { data, error } = await supabase
    .from('project_versions')
    .insert({
      project_id: projectId,
      blockly_xml: blocklyXml,
      generated_code: generatedCode,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating cloud version:', error);
    return null;
  }

  // Clean up old versions
  await cleanupOldVersions(projectId);

  return data;
};

export const getCloudProjectVersions = async (projectId: string): Promise<CloudProjectVersion[]> => {
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cloud versions:', error);
    return [];
  }

  return data || [];
};

const cleanupOldVersions = async (projectId: string): Promise<void> => {
  const versions = await getCloudProjectVersions(projectId);
  
  if (versions.length > MAX_VERSIONS) {
    const toDelete = versions.slice(MAX_VERSIONS);
    
    for (const version of toDelete) {
      await supabase
        .from('project_versions')
        .delete()
        .eq('id', version.id);
    }
  }
};

// Sync local project to cloud
export const syncProjectToCloud = async (
  localProject: {
    id?: string;
    name: string;
    blocklyXml: string;
    generatedCode: string;
    board: string;
  },
  cloudProjectId?: string
): Promise<CloudProject | null> => {
  if (cloudProjectId) {
    // Update existing cloud project
    return updateCloudProject(cloudProjectId, {
      name: localProject.name,
      blockly_xml: localProject.blocklyXml,
      generated_code: localProject.generatedCode,
      board: localProject.board,
    });
  } else {
    // Create new cloud project
    return createCloudProject(
      localProject.name,
      localProject.blocklyXml,
      localProject.generatedCode,
      localProject.board
    );
  }
};

// Compile code using the edge function
export interface CompileResult {
  success: boolean;
  hex?: string;
  output?: string;
  error?: string;
}

export const compileArduinoCode = async (
  code: string,
  board: string
): Promise<CompileResult> => {
  try {
    const { data, error } = await supabase.functions.invoke('compile-arduino', {
      body: { code, board },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return data as CompileResult;
  } catch (err) {
    console.error('Compile request error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to compile code',
    };
  }
};
