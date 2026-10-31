import { Helmet } from 'react-helmet-async';
import { safeHtml } from '@/lib/safeHtml';
import Ending from '@/ui-kit/Ending/Ending';
import PrintStack from '@/ui-kit/PrintStack/PrintStack';
import Reel from '@/ui-kit/Reel/Reel';
import { journeyEnding, projects } from './projects.data';

const ProjectsTab = () => {
  return (
    <>
      <Helmet>
        <title>Learning Journey - Scott Sun</title>
        <meta
          name="description"
          content="Scott Sun's learning journey and projects - from programming to deep learning, AI, Blender, Unity, and app development."
        />
      </Helmet>
      <div className="grid page-head">
        <h1>Learning Journey</h1>
      </div>
      {projects.map((project) => (
        <article key={project.id} className="grid chapter">
          <div className="head">
            <div className="date">{project.date}</div>
            <h2>{project.title}</h2>
          </div>
          <div
            className="prose"
            dangerouslySetInnerHTML={safeHtml(project.description)}
          />
          <aside className="side">
            {project.images.length > 0 && (
              <PrintStack images={project.images} caption={project.title} />
            )}
            {project.videos.length > 0 && <Reel videos={project.videos} />}
          </aside>
        </article>
      ))}
      <Ending ending={journeyEnding} />
    </>
  );
};

export default ProjectsTab;
