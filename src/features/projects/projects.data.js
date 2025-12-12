export const projects = [
  {
    id: 'programming-start',
    projectId: 1,
    title: 'Picked Up Programming Before the ChatGPT Moment',
    date: 'Mar. 2022',
    description: `First stepping into a new field and learning tangible things is exciting and satisfying. This is especially true for programming. The basic realization became—huh, I can just build things.<br><br>

I chose the book <span class="italic font-semibold">Python Crash Course</span> as a no-brainer and I still remember the Alien Invasion game made with pygame and the Learning Log with Django (although I started a new app called Book Share using everything I'd already learned in Learning Log and pushed so much further than what I knew), as I'm certain many people who started Python with this book do.<br><br>

Programming is only a subdomain of computer science, and a programming language itself can be tedious. So I have learned the basics and intermediate Python, the immediate question that hit me was—what do I use it for?`,
    images: ['alien_invasion.jpeg', 'bookshare.jpeg'],
    videos: [],
  },
  {
    id: 'deep-learning',
    projectId: 2,
    title: 'Deep Learning Caught My Attention',
    date: 'Aug. 2022',
    description: `You remember that famous TV show Person of Interest? The iconic starting line was <span class="italic">"You are being watched. … A machine that spies on you every hour of every day. … I know, because I built it"</span>. I was fascinated about that show, and it drove me down a rabbit hole of research into artificial intelligence and the state of the art (at the time of course). Interestingly the show depicted the machine as completely hard-coded by Harold while real AI systems are neural net based models. I didn't know this distinction until later <i class="fa-solid fa-face-laugh-wink" aria-hidden="true"></i>.<br><br>

It was around the same time that a thing called "GPT" came out of nowhere (GPT-3 and GPT-3.5 small scale beta testing had already made its name) and started to create some real buzz.<br><br>

I knew absolutely nothing about AI, machine learning, and deep learning at the time. Zero. From an initial toe dipping, I realized learning AI required a tremendous amount of understanding in math and quite sophisticated coding skills. I wasn't sure I was up for it, but I decided to give it a try. That decision has led me such a long way here in retrospect.`,
    images: ['poi.jpeg', 'early_chatgpt.jpeg'],
    videos: [],
  },
  {
    id: 'learn-things',
    projectId: 3,
    title: 'You Can Just Learn Things',
    date: 'Jan. 2023',
    description: `I was starting to get a rhythm on diving into something entirely new. So again I started with the basics—neural networks. I soon realized it was not as difficult as I had imagined it to be to at least get started on, because I had already had foundations on calculus and statistics, and "that thing" called linear algebra which I had painfully learned as a mandatory class in undergrad without knowing what the heck it was for, suddenly became unbelievably important. I quickly absorbed concepts like backpropagation and gradient descent, and fundamentals on MLP, CNN, RNN, and RL (didn't pay Attention to the Transformer—pun intended—until later sadly).<br><br>

Soon I moved to building practical and fun small projects following tutorials using, you guessed it, Keras. I built and trained a super simple chatbot using just MLP in one-hot encoding with a lengthy pre-written dialogue json (it looks utterly laughable now compared to transformer based LLMs but I had so much fun building it). I also built and trained a dog/cat image detection model with CNN among other things, as it is sorta like the rite of passage for all deep learning beginners <i class="fa-solid fa-face-laugh-wink" aria-hidden="true"></i>.<br><br>

But finally something big caught my attention, and it's called <span class="italic font-semibold">Let's build GPT: from scratch, in code, spelled out</span> from the legend Andrej Karpathy! The first 10 mins in I quit, because I hadn't even learned PyTorch yet <i class="fa-solid fa-face-sad-cry" aria-hidden="true"></i>. I quickly did a PyTorch crash course, and I realized that I actually needed to learn to manipulate tensors in really granular ways instead of just stacking prebuilt layers like in Keras. After the quick PyTorch course, this time I didn't directly jump into building GPT, but started from the first video tutorial in Karpathy's channel and started intensively absorbing pure knowledge and brilliance, until finally I got to the super fun bonus part.<br><br>

I followed along every step in his building GPT video, doing side research whenever I saw something I didn't understand, including reading <span class="italic font-semibold">Attention Is All You Need</span> paper dozens of times repeatedly, with each time getting just a bit more clarity. And finally, model was built and trained, I was able to see the tokens being generated one by one, and that was a magical moment.<br><br>

Later I reviewed everything I learned from the mini-GPT dev and I pre-trained a GPT-like (100M Params) LLM from scratch using a portion of the Common Crawl dataset, and further finetuned it with some instruction datasets I could find at the time. The model achieved above 20 on Hellaswag.`,
    images: ['karpathy_tutorial.jpeg', 'makemore.jpeg', 'miniGPT.jpeg'],
    videos: [],
  },
  {
    id: 'blender-unity',
    projectId: 4,
    title: 'Blender & Unity, A Change of Pace',
    date: 'Apr. 2023',
    description: `Today I don't even remember how it started, but somehow I decided to learn Blender. I tend to think it is because 3D modeling and rendering is another epitome for the phrase "you can just build things". And the exhilaration you get from creating something beautiful out of thin air is beyond words.<br><br>

Building 3D models can be extremely time-consuming, EXTREMELY! But I enjoyed every minute of it. Seeing what you are building becoming just a bit more perfect is satisfying to say the least. During my learning in a few months, I made some beautiful rendered scenes and animations into final videos, and I would lay down sound tracks for them to make them even more cinematic. Considering I did all these on my old gaming laptop with an outdated GPU (even at the time), I am really happy I was able to make these! I selected some of them which I really like and threaded them into a video cut.<br><br>

I also started to learn some game dev with Unity. I made a few simple but interesting games (I put two of them—SkyPool & Turbo Drift—on Google Drive with a public link. They are built so you can download it and play directly, although only built for MacOS: <a href='https://drive.google.com/drive/folders/1Ynak7R-LkBaeHCJiFmLUkm4S4ULqIBBj?usp=sharing' target="_blank" class="text-blue-200 underline">Link Here</a>).`,
    images: ['blender.jpeg', 'SkyPool.jpeg', 'Turbo_Drift.jpeg'],
    videos: [
      {
        id: 'youtube-player-1',
        videoId: '3NA4uyCcUD4',
        title: 'Blender Renders',
      },
    ],
  },
  {
    id: 'autodrive',
    projectId: 5,
    title: 'AutoDrive—3D Modeling and Unity, Meet ML',
    date: 'Jun. 2023',
    description: `As I was having fun making game projects, I came across a library developed by the Unity team called ML-Agents. This framework allows you to develop and train robotic agents with RL in a virtual world inside the Unity game engine, sorta like a simpler version of Nvidia's Isaac Sim. This became a perfect crossover project between Blender, Unity, and ML for me.<br><br>
                        
I used Blender to develop a 3D car model, exported it to Unity, and built a convoluted tunnel scene with the car being the agent, navigating out of the tunnel via RL-learned self driving. After weeks of painstaking adjustments on reward functions (in C#) and hyperparameters, and countless training failures, finally I successfully trained an agent capable of steering the car out of the tunnel autonomously.`,
    images: ['autodrive_code.jpeg'],
    videos: [
      {
        id: 'youtube-player-2',
        videoId: 'Ur7uA-IiZck',
        title: 'AutoDrive',
      },
    ],
  },
  {
    id: 'msc-certificates',
    projectId: 6,
    title: 'Different Country, MSc Business, & Certificate Phase',
    date: 'Sep. 2023',
    description: `Going to a different country for a Masters study is a big change. I was excited to learn about business, and most importantly, to learn life in a different speed and spectrum.<br><br>

In the meantime, I went into a little bit of a tech certificate phase. Did a full Harvard CS50 class, cloud certificates from Azure and AWS, as well as some advance AI engineering classes.<br><br>
                        
But eventually, I realized that the best way to learn is after all project building. When you build, you're forced to think about things from first principles, and you're forced to go through every single technical detail instead of just going through them in your mind, which makes you super sharp in every part of the tech stack.`,
    images: ['cs50.jpeg', 'cs50_cert.jpeg'],
    videos: [],
  },
  {
    id: 'app-dev-ai',
    projectId: 7,
    title: 'Recreational App Dev & Frontier AI Chase',
    date: 'Jan. 2024',
    description: `Making apps that solve small but practical problems is recreational and good for the soul.<br><br>

I suppose building things is addictive. Once you get a taste of the process, you can't help but see real world problems with the perspective of “can I build something to make this easier, or better?” Sometimes it's not even about practical value, but simply to watch something you built work. I've built many things along the way, most are crude and primitive, and didn't make it out of the project phase. But they were sure fun to build and valuable for learning how to iterate. Some did get refined and deployed, so anyone can use them.<br><br>

Gradually, I have also gotten into the habit of reading frontier AI research papers. Every week I would check the Hugging Face Daily Papers section for interesting papers, and of course not all of them would make it to HF, and so 𝕏 is my paper hunting safety net. Reading raw AI papers forces me to constantly replenish my knowledge pool. Luckily there are tools like Claude and NotebookLM that make this process easier for me.`,
    images: [
      'vacation_planner.jpeg',
      'transcrilate.jpeg',
      'hf_daily_papers.jpeg',
      'arxiv.jpeg',
    ],
    videos: [],
  },
  {
    id: 'ai_profession_days',
    projectId: 8,
    title: 'Can You Even Imagine Life Without AI?',
    date: 'Feb. 2025',
    description: `It's only been a couple of years, but it's hard to remember the time before AI.<br><br>

It's remarkable if you think about it. A little seed of progress that turned out to be literally world-changing. AI has become my work, and my work has become AI.<br><br>

But it's more than that. For those who are constantly curious, and those who always want to build stuff and push limits, AI is the best thing ever. You'd have several genius level assistants at your beck and call 24/7, augmenting you non stop. Having AI like a suit of armor around your brain is immense freedom, freedom from ignorance, from helplessness, and from limits. 
`,
    images: [
      'ai_engineering.jpeg',
      'karpathy_like.jpeg',
      'msft_guest.jpeg',
      'google_guest.jpeg',
    ],
    videos: [],
  },
  {
    id: 'back_to_basics',
    projectId: 9,
    title: 'Back to Basics',
    date: 'Dec. 2025 onward',
    description: `Constantly building the next shiny thing will make you forget the fundamentals.<br><br>

I still remember fondly how I got started on this path, drilling down on Karpathy tutorials, grinding on code, reading obscure math, and that was when there was no community, no access to today's level of AI or GPUs.<br><br>

I'm dialing back a bit. Back to reading more papers, and especially back to practical learning. The Effort to train a diffusion language model the "Karpathy style" marks a start.<br><br>

This is a 35M params diffusion language model I trained from scratch. It is based on the MDLM paper (great paper btw). I tried to simulate the entire “Let's build GPT” learning experience. Must say, the learning process is super charged with the help of AI if you know how to use them well. Pretty cool paper and project: <a href='https://github.com/scottstts/Learning-Diffusion-LM/' target="_blank" class="text-blue-200 underline">Repo Here</a>.
`,
    images: ['mdlm1.jpeg', 'mdlm2.jpeg', 'mdlm3.jpeg'],
    videos: [],
  },
];
