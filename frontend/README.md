Je voudrais créer un outils drivé par un LLM nommé Plot Partner qui servirait autant aux MJ de jeu de rôle qu’aux auteurs de fiction en mettant en forme une histoire sous forme de graphs et de récapitulatif : avoir un graph de son histoire un peu à la Twine, mais qui génère les fiches personnages, comptabilises les mots, les personnages, les objets clés, les lieux liés à quels lieux etc. avec un affichage par lieu, par event, par perso etc. Le but est que le LLM soit capable de suivre « ok tes joueurs sont là, ils peuvent donc aller là ou là » et connaisse tout de l’histoire. 


Il y a un event : en jdr, c’est une étape clé du scénario, event au sens propre, en roman c’est probablement un chapitre. 
Il y a des possibilités offertes : en jdr des petites actions, en roman des scènes. 
Il y a des personnages en action 
Il y a des lieux accessibles 
Il y a des objets accessibles 

Visual Graph : React Flow en front.
Back-end : Python. 

[ Navigateur ]
      ↓
[ Frontend React + React Flow ]
      ↓ API (JSON)
[ Backend Python - FastAPI ]
      ↓
[ Moteur narratif + State + LLM ]

Nodes :
•	Block
•	Scene
•	Character
•	Location
•	Object

Edges :
•	PART_OF (scene → block)
•	NEXT_SCENE
•	PRESENT_IN
•	LOCATED_IN
•	USES
•	CONTAINS

